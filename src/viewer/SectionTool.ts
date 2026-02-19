/**
 * SectionTool — Three.js-based clipping plane with gumball, stencil cap/fill.
 *
 * This replaces the That Open Engine Clipper / ClipStyler / SimplePlane APIs
 * with native Three.js equivalents:
 *   - THREE.Plane              → clipping plane
 *   - TransformControls        → gumball for moving the plane
 *   - Stencil rendering        → cap / fill surface at the cut
 *   - PlaneHelper-like mesh    → visible section plane indicator
 *
 * The stencil approach renders the back-faces into the stencil buffer where
 * clipped, then draws a filled quad only where stencil != 0, producing a
 * solid "cap" at the section cut.
 */
import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type PlaneAxis = 'X' | 'Y' | 'Z';
export type GumballAxis = 'X' | 'Y' | 'Z';

/** Normals for each axis selection (Z-up convention) */
const AXIS_NORMALS: Record<PlaneAxis, THREE.Vector3> = {
    X: new THREE.Vector3(1, 0, 0), // YZ plane
    Y: new THREE.Vector3(0, 1, 0), // XZ plane
    Z: new THREE.Vector3(0, 0, 1), // XY plane
};

/** Fill colour for the section cap surface */
const CAP_FILL_COLOR = 0x6699cc;
const CAP_FILL_OPACITY = 0.35;

/** Section plane indicator colour */
const PLANE_HELPER_COLOR = 0xffcc00;
const PLANE_HELPER_OPACITY = 0.15;

export class SectionTool {
    // --- Core references ---
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private renderer: THREE.WebGLRenderer;
    private orbitControls: OrbitControls;
    private modelGroup: THREE.Group;
    private domElement: HTMLElement;

    // --- Clipping plane ---
    private clippingPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    private planeNormal: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
    private planeCenter: THREE.Vector3 = new THREE.Vector3();

    // --- Gumball (TransformControls) ---
    private gumball: TransformControls | null = null;
    private gumballAnchor: THREE.Object3D = new THREE.Object3D();

    // --- Visual plane indicator ---
    private planeHelper: THREE.Mesh | null = null;

    // --- Stencil cap/fill ---
    private capGroup: THREE.Group = new THREE.Group();
    private capFillMesh: THREE.Mesh | null = null;

    // --- State ---
    private _enabled = false;
    private _capVisible = true;
    private _flipped = false;
    private _currentAxis: PlaneAxis = 'Z';
    private _gumballAxis: GumballAxis = 'Z';
    private _isDragging = false;
    private _rafPending = false;

    // --- Original material clipping planes (tracked for cleanup) ---
    private clippedMaterials: Set<THREE.Material> = new Set();

    constructor(opts: {
        scene: THREE.Scene;
        camera: THREE.Camera;
        renderer: THREE.WebGLRenderer;
        orbitControls: OrbitControls;
        modelGroup: THREE.Group;
        domElement: HTMLElement;
    }) {
        this.scene = opts.scene;
        this.camera = opts.camera;
        this.renderer = opts.renderer;
        this.orbitControls = opts.orbitControls;
        this.modelGroup = opts.modelGroup;
        this.domElement = opts.domElement;

        // Cap group is always in scene but empty when disabled
        this.capGroup.name = '__sectionCap__';
        this.capGroup.renderOrder = 999;
        this.scene.add(this.capGroup);
    }

    // ===== Public getters =====
    get enabled() { return this._enabled; }
    get capVisible() { return this._capVisible; }
    get flipped() { return this._flipped; }
    get currentAxis() { return this._currentAxis; }
    get gumballAxis() { return this._gumballAxis; }

    // ===== Enable / Disable =====

    enable(axis?: PlaneAxis) {
        if (axis) this._currentAxis = axis;
        this._enabled = true;
        this._flipped = false;

        // Ensure renderer supports local clipping
        this.renderer.localClippingEnabled = true;

        // Compute model bounding box center
        const box = new THREE.Box3().setFromObject(this.modelGroup);
        if (box.isEmpty()) {
            this.planeCenter.set(0, 0, 0);
        } else {
            box.getCenter(this.planeCenter);
        }

        // Set normal from axis
        this.planeNormal.copy(AXIS_NORMALS[this._currentAxis]);

        // Set THREE.Plane (normal points away from clipped region)
        this.clippingPlane.setFromNormalAndCoplanarPoint(this.planeNormal, this.planeCenter);

        // Apply clipping plane to all model materials
        this.applyClippingToMaterials();

        // Create visible plane helper
        this.createPlaneHelper(box);

        // Create gumball
        this.createGumball();

        // Create cap/fill
        this.createCapFill(box);

        // Position anchor at plane center
        this.gumballAnchor.position.copy(this.planeCenter);
        this.updatePlaneFromAnchor();
    }

    disable() {
        this._enabled = false;
        this.removeGumball();
        this.removePlaneHelper();
        this.removeCapFill();
        this.removeClippingFromMaterials();
        this.renderer.localClippingEnabled = false;

        // Hide cap group so no stencil artefacts linger
        this.capGroup.visible = false;

        // Reset stencil test so the GPU doesn't keep evaluating stencil ops
        const gl = this.renderer.getContext();
        if (gl) {
            gl.disable(gl.STENCIL_TEST);
        }
    }

    // ===== Plane Axis =====

    setPlaneAxis(axis: PlaneAxis) {
        this._currentAxis = axis;
        this._flipped = false;
        if (!this._enabled) return;

        // Recompute center
        const box = new THREE.Box3().setFromObject(this.modelGroup);
        if (!box.isEmpty()) box.getCenter(this.planeCenter);

        this.planeNormal.copy(AXIS_NORMALS[axis]);
        this.clippingPlane.setFromNormalAndCoplanarPoint(this.planeNormal, this.planeCenter);

        this.gumballAnchor.position.copy(this.planeCenter);
        this.updatePlaneHelper(box);
        this.updateCapFill(box);
        this.setGumballAxis(this._gumballAxis);
    }

    // ===== Gumball Axis Constraint =====

    setGumballAxis(axis: GumballAxis) {
        this._gumballAxis = axis;
        if (!this.gumball) return;

        this.gumball.showX = axis === 'X';
        this.gumball.showY = axis === 'Y';
        this.gumball.showZ = axis === 'Z';
    }

    // ===== Flip Normal =====

    flipNormal() {
        this._flipped = !this._flipped;
        if (!this._enabled) return;

        this.planeNormal.negate();
        this.clippingPlane.setFromNormalAndCoplanarPoint(this.planeNormal, this.gumballAnchor.position);
        this.updateCapOrientation();
    }

    // ===== Reset to Center =====

    resetToCenter() {
        if (!this._enabled) return;

        const box = new THREE.Box3().setFromObject(this.modelGroup);
        if (!box.isEmpty()) box.getCenter(this.planeCenter);

        this._flipped = false;
        this.planeNormal.copy(AXIS_NORMALS[this._currentAxis]);
        this.gumballAnchor.position.copy(this.planeCenter);
        this.clippingPlane.setFromNormalAndCoplanarPoint(this.planeNormal, this.planeCenter);
        this.updatePlaneHelper(box);
        this.updateCapFill(box);
    }

    // ===== Clear (hard reset) =====

    clear() {
        this.disable();
        this._currentAxis = 'Z';
        this._gumballAxis = 'Z';
        this._flipped = false;
        this._capVisible = true;
    }

    // ===== Cap Visibility =====

    setCapVisible(visible: boolean) {
        this._capVisible = visible;
        this.capGroup.visible = visible;
    }

    // ===== Update camera reference (for projection changes) =====

    updateCamera(camera: THREE.Camera) {
        this.camera = camera;
        if (this.gumball) {
            this.gumball.camera = camera;
        }
    }

    // ===== Dispose =====

    dispose() {
        this.clear();
        this.scene.remove(this.capGroup);
    }

    // ===================================================================
    //  PRIVATE IMPLEMENTATION
    // ===================================================================

    // --- Apply clipping plane to all materials in the model ---
    private applyClippingToMaterials() {
        this.modelGroup.traverse((obj) => {
            if (!(obj instanceof THREE.Mesh)) return;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const mat of mats) {
                if (!mat.clippingPlanes) {
                    mat.clippingPlanes = [];
                }
                if (!mat.clippingPlanes.includes(this.clippingPlane)) {
                    mat.clippingPlanes.push(this.clippingPlane);
                }
                mat.clipShadows = true;
                mat.needsUpdate = true;
                this.clippedMaterials.add(mat);
            }
        });
    }

    private removeClippingFromMaterials() {
        for (const mat of this.clippedMaterials) {
            if (mat.clippingPlanes) {
                const idx = mat.clippingPlanes.indexOf(this.clippingPlane);
                if (idx >= 0) mat.clippingPlanes.splice(idx, 1);
                if (mat.clippingPlanes.length === 0) mat.clippingPlanes = null;
            }
            mat.needsUpdate = true;
        }
        this.clippedMaterials.clear();
    }

    // --- Plane Helper (visible section indicator) ---
    private createPlaneHelper(box: THREE.Box3) {
        this.removePlaneHelper();

        const size = box.isEmpty()
            ? 20
            : box.getSize(new THREE.Vector3()).length() * 0.8;

        const geometry = new THREE.PlaneGeometry(size, size);
        const material = new THREE.MeshBasicMaterial({
            color: PLANE_HELPER_COLOR,
            transparent: true,
            opacity: PLANE_HELPER_OPACITY,
            side: THREE.DoubleSide,
            depthWrite: false,
        });

        this.planeHelper = new THREE.Mesh(geometry, material);
        this.planeHelper.name = '__sectionPlaneHelper__';

        // Orient to match plane normal
        this.orientMeshToNormal(this.planeHelper, this.planeNormal);
        this.planeHelper.position.copy(this.planeCenter);

        this.scene.add(this.planeHelper);
    }

    private updatePlaneHelper(box: THREE.Box3) {
        if (!this.planeHelper) {
            this.createPlaneHelper(box);
            return;
        }

        this.orientMeshToNormal(this.planeHelper, this.planeNormal);
        this.planeHelper.position.copy(this.gumballAnchor.position);
    }

    private removePlaneHelper() {
        if (this.planeHelper) {
            this.planeHelper.geometry.dispose();
            (this.planeHelper.material as THREE.Material).dispose();
            this.scene.remove(this.planeHelper);
            this.planeHelper = null;
        }
    }

    // --- Stencil-based cap / fill ---
    private createCapFill(box: THREE.Box3) {
        this.removeCapFill();

        const size = box.isEmpty()
            ? 40
            : box.getSize(new THREE.Vector3()).length() * 1.2;

        // The "fill" plane rendered only where the stencil was written.
        // We use renderer stencil buffer to detect the cross-section area.
        // However, the simple approach: just render a large plane at the
        // clipping location with proper orientation. For true stencil fill
        // we'd need a multi-pass setup. Here we use a simpler but effective
        // approach: a translucent fill plane that is co-planar with the
        // clipping plane, clipped to the model silhouette via the stencil.

        // Simpler approach: render a fill plane that visually indicates the cut
        const fillGeo = new THREE.PlaneGeometry(size, size);
        const fillMat = new THREE.MeshBasicMaterial({
            color: CAP_FILL_COLOR,
            transparent: true,
            opacity: CAP_FILL_OPACITY,
            side: THREE.DoubleSide,
            depthWrite: false,
            // The fill must also be clipped to only appear where model exists
            // We offset it very slightly to avoid z-fighting
        });

        this.capFillMesh = new THREE.Mesh(fillGeo, fillMat);
        this.capFillMesh.renderOrder = 1000;
        this.orientMeshToNormal(this.capFillMesh, this.planeNormal);
        this.capFillMesh.position.copy(this.gumballAnchor.position);

        this.capGroup.add(this.capFillMesh);
        this.capGroup.visible = this._capVisible;

        // Enable stencil-based cap rendering for proper cross-section fill
        this.setupStencilCap(size);
    }

    /**
     * Set up stencil-based cap rendering.
     * This creates proper filled cross-sections by:
     * 1. Rendering back-faces with stencil increment where clipped
     * 2. Rendering front-faces with stencil decrement where clipped
     * 3. Drawing the fill plane only where stencil != 0
     */
    private setupStencilCap(_size: number) {
        if (!this.capFillMesh) return;

        // Enable stencil on the renderer
        const gl = this.renderer.getContext();
        if (gl) {
            this.renderer.state.buffers.stencil.setTest(true);
        }

        // Configure the fill mesh to only render where stencil is non-zero
        const fillMat = this.capFillMesh.material as THREE.MeshBasicMaterial;
        fillMat.stencilWrite = false;
        fillMat.stencilRef = 0;
        fillMat.stencilFunc = THREE.NotEqualStencilFunc;
        fillMat.stencilFail = THREE.KeepStencilOp;
        fillMat.stencilZFail = THREE.KeepStencilOp;
        fillMat.stencilZPass = THREE.KeepStencilOp;

        // Now we need to add stencil ops to the model materials
        // Back-faces increment stencil, front-faces decrement stencil
        // This is done per-frame in the render loop integration
        this.enableStencilOnModel();
    }

    /**
     * Enable stencil writing on model materials so that the cross-section
     * area is correctly identified in the stencil buffer.
     *
     * Each mesh gets cloned into two passes:
     * - Pass 1 (back-face): stencil increment
     * - Pass 2 (front-face): stencil decrement
     * The net result is stencil != 0 only inside the model cross-section.
     */
    private stencilMeshes: THREE.Mesh[] = [];

    private enableStencilOnModel() {
        this.disableStencilOnModel();

        this.modelGroup.traverse((obj) => {
            if (!(obj instanceof THREE.Mesh)) return;
            if (!obj.visible) return;

            const originalMat = obj.material as THREE.Material;

            // Back-face pass: increment stencil
            const backMat = originalMat.clone();
            backMat.side = THREE.BackSide;
            backMat.clippingPlanes = [this.clippingPlane];
            backMat.stencilWrite = true;
            backMat.stencilRef = 0;
            backMat.stencilFunc = THREE.AlwaysStencilFunc;
            backMat.stencilFail = THREE.KeepStencilOp;
            backMat.stencilZFail = THREE.KeepStencilOp;
            backMat.stencilZPass = THREE.IncrementWrapStencilOp;
            backMat.depthWrite = false;
            backMat.colorWrite = false;

            const backMesh = new THREE.Mesh(obj.geometry, backMat);
            backMesh.matrix.copy(obj.matrixWorld);
            backMesh.matrixAutoUpdate = false;
            backMesh.renderOrder = 998;
            backMesh.name = '__stencilBack__';

            // Front-face pass: decrement stencil
            const frontMat = originalMat.clone();
            frontMat.side = THREE.FrontSide;
            frontMat.clippingPlanes = [this.clippingPlane];
            frontMat.stencilWrite = true;
            frontMat.stencilRef = 0;
            frontMat.stencilFunc = THREE.AlwaysStencilFunc;
            frontMat.stencilFail = THREE.KeepStencilOp;
            frontMat.stencilZFail = THREE.KeepStencilOp;
            frontMat.stencilZPass = THREE.DecrementWrapStencilOp;
            frontMat.depthWrite = false;
            frontMat.colorWrite = false;

            const frontMesh = new THREE.Mesh(obj.geometry, frontMat);
            frontMesh.matrix.copy(obj.matrixWorld);
            frontMesh.matrixAutoUpdate = false;
            frontMesh.renderOrder = 998;
            frontMesh.name = '__stencilFront__';

            this.capGroup.add(backMesh);
            this.capGroup.add(frontMesh);
            this.stencilMeshes.push(backMesh, frontMesh);
        });
    }

    private disableStencilOnModel() {
        for (const mesh of this.stencilMeshes) {
            (mesh.material as THREE.Material).dispose();
            this.capGroup.remove(mesh);
        }
        this.stencilMeshes = [];
    }

    private updateCapFill(box: THREE.Box3) {
        this.createCapFill(box);
    }

    private updateCapOrientation() {
        if (this.capFillMesh) {
            this.orientMeshToNormal(this.capFillMesh, this.planeNormal);
        }
    }

    private removeCapFill() {
        this.disableStencilOnModel();
        if (this.capFillMesh) {
            this.capFillMesh.geometry.dispose();
            (this.capFillMesh.material as THREE.Material).dispose();
            this.capGroup.remove(this.capFillMesh);
            this.capFillMesh = null;
        }
    }

    // --- TransformControls gumball ---
    private createGumball() {
        this.removeGumball();

        this.gumball = new TransformControls(this.camera, this.domElement);
        this.gumball.setMode('translate');
        this.gumball.setSize(0.8);

        // Attach to anchor
        this.gumballAnchor.position.copy(this.planeCenter);
        this.scene.add(this.gumballAnchor);
        this.gumball.attach(this.gumballAnchor);
        this.scene.add(this.gumball.getHelper());

        // Apply axis constraint
        this.setGumballAxis(this._gumballAxis);

        // --- Continuous update while dragging ---
        this.gumball.addEventListener('change', this.onGumballChange);

        // --- Disable orbit controls while dragging ---
        this.gumball.addEventListener('dragging-changed', this.onDraggingChanged);
    }

    private removeGumball() {
        if (this.gumball) {
            this.gumball.removeEventListener('change', this.onGumballChange);
            this.gumball.removeEventListener('dragging-changed', this.onDraggingChanged);
            this.gumball.detach();
            this.scene.remove(this.gumball.getHelper());
            this.gumball.dispose();
            this.gumball = null;
        }
        this.scene.remove(this.gumballAnchor);
    }

    private onGumballChange = () => {
        if (!this._enabled) return;

        // Update the clipping plane to follow the anchor
        this.updatePlaneFromAnchor();

        // Throttle expensive cap updates with rAF
        if (!this._rafPending) {
            this._rafPending = true;
            requestAnimationFrame(() => {
                this._rafPending = false;
                if (this._isDragging && this._capVisible) {
                    this.updateStencilMatrices();
                }
            });
        }
    };

    private onDraggingChanged = (event: { value: unknown }) => {
        const dragging = !!event.value;
        // Disable orbit while dragging the gumball
        this.orbitControls.enabled = !dragging;
        this._isDragging = dragging;

        // On drag end, do a final update of stencil meshes
        if (!dragging && this._capVisible) {
            this.rebuildStencilMeshes();
        }
    };

    // Update THREE.Plane and visual helpers from the gumball anchor position
    private updatePlaneFromAnchor() {
        const pos = this.gumballAnchor.position;
        this.clippingPlane.setFromNormalAndCoplanarPoint(this.planeNormal, pos);

        // Move visual plane helper
        if (this.planeHelper) {
            this.planeHelper.position.copy(pos);
        }

        // Move cap fill mesh
        if (this.capFillMesh) {
            this.capFillMesh.position.copy(pos);
        }
    }

    // Quick update: just move the stencil mesh matrices (used during drag for perf)
    private updateStencilMatrices() {
        // Stencil meshes use world matrices from the original meshes,
        // and the plane has already moved. The stencil is re-evaluated
        // by the GPU on next render because clippingPlane is a reference.
        // No need to update matrices — they stay with the model.
        // The cap fill mesh position is already updated in updatePlaneFromAnchor.
    }

    // Full rebuild of stencil meshes (on drag end or axis change)
    private rebuildStencilMeshes() {
        if (!this._enabled || !this._capVisible) return;
        const box = new THREE.Box3().setFromObject(this.modelGroup);
        this.createCapFill(box);
    }

    // --- Orient a mesh so its local Z axis aligns with the given normal ---
    private orientMeshToNormal(mesh: THREE.Mesh, normal: THREE.Vector3) {
        const target = mesh.position.clone().add(normal);
        mesh.lookAt(target);
    }
}
