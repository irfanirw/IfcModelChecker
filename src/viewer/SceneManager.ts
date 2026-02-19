/**
 * Three.js Scene Manager
 * Manages the 3D scene, camera, controls, grid, world axis, selection
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GRID_DEFAULTS, AXIS_COLORS, CAMERA_PRESETS, SELECTION_COLOR, SELECTION_OPACITY } from '@/constants';
import { useViewStore, useSelectionStore, useVisibilityStore } from '@/store';
import type { ViewPreset, ProjectionMode, DisplayMode } from '@/types';
import type { GeometryData } from '@/workers/ifcParser.worker';
import { SectionTool } from '@/viewer/SectionTool';

export class SceneManager {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    perspectiveCamera: THREE.PerspectiveCamera;
    orthographicCamera: THREE.OrthographicCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    container: HTMLElement;

    private gridGroup: THREE.Group;
    private worldAxisGroup: THREE.Group;
    private axisHelperRenderer: THREE.WebGLRenderer | null = null;
    private axisHelperScene: THREE.Scene | null = null;
    private axisHelperCamera: THREE.PerspectiveCamera | null = null;

    private modelGroup: THREE.Group;
    private meshMap: Map<number, THREE.Mesh> = new Map();
    private originalMaterials: Map<number, THREE.Material> = new Map();
    private selectionMaterial: THREE.MeshPhongMaterial;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;

    private animationFrameId: number | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private disposed = false;

    /** Section tool for clipping planes with gumball & cap fill */
    sectionTool: SectionTool | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);

        const aspect = container.clientWidth / container.clientHeight;

        // Perspective camera
        this.perspectiveCamera = new THREE.PerspectiveCamera(60, aspect, 0.1, 10000);
        this.perspectiveCamera.position.set(20, 20, 20);
        this.perspectiveCamera.up.set(0, 0, 1);

        // Orthographic camera
        const frustumSize = 50;
        this.orthographicCamera = new THREE.OrthographicCamera(
            -frustumSize * aspect, frustumSize * aspect,
            frustumSize, -frustumSize,
            0.1, 10000
        );
        this.orthographicCamera.position.set(20, 20, 20);
        this.orthographicCamera.up.set(0, 0, 1);

        this.camera = this.perspectiveCamera;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = false;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.target.set(0, 0, 0);
        this.controls.update();

        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
        dir1.position.set(50, 50, 50);
        this.scene.add(dir1);

        const dir2 = new THREE.DirectionalLight(0xffffff, 0.3);
        dir2.position.set(-50, -50, 20);
        this.scene.add(dir2);

        // Grid
        this.gridGroup = this.createGrid();
        this.scene.add(this.gridGroup);

        // World Axis at origin
        this.worldAxisGroup = this.createWorldAxis();
        this.scene.add(this.worldAxisGroup);

        // Model group
        this.modelGroup = new THREE.Group();
        this.scene.add(this.modelGroup);

        // Selection material
        this.selectionMaterial = new THREE.MeshPhongMaterial({
            color: SELECTION_COLOR,
            transparent: true,
            opacity: SELECTION_OPACITY,
            depthWrite: false,
        });

        // Raycaster
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Section tool (clipping plane with gumball & cap fill)
        this.sectionTool = new SectionTool({
            scene: this.scene,
            camera: this.camera,
            renderer: this.renderer,
            orbitControls: this.controls,
            modelGroup: this.modelGroup,
            domElement: this.renderer.domElement,
        });

        // Event listeners
        this.renderer.domElement.addEventListener('click', this.onClick);
        this.renderer.domElement.addEventListener('mousemove', this.onMouseMove);

        // WebGL context loss recovery
        this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.warn('[SceneManager] WebGL context lost');
            if (this.animationFrameId !== null) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
        });
        this.renderer.domElement.addEventListener('webglcontextrestored', () => {
            console.log('[SceneManager] WebGL context restored');
            this.animate();
        });

        // Resize observer
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(container);

        // Start render loop
        this.animate();
    }

    // ===== Grid (Rhino-like) =====
    private createGrid(): THREE.Group {
        const group = new THREE.Group();
        group.name = '__grid__';

        const { size, spacing, majorInterval, opacity, majorOpacity, color, majorColor, centerColor } = GRID_DEFAULTS;
        const halfSize = size / 2;
        const divisions = size / spacing;

        // Minor grid lines
        const minorGeo = new THREE.BufferGeometry();
        const minorPositions: number[] = [];

        for (let i = -halfSize; i <= halfSize; i += spacing) {
            if (i % (spacing * majorInterval) === 0) continue; // skip major lines
            // X-parallel
            minorPositions.push(-halfSize, i, 0, halfSize, i, 0);
            // Y-parallel
            minorPositions.push(i, -halfSize, 0, i, halfSize, 0);
        }

        minorGeo.setAttribute('position', new THREE.Float32BufferAttribute(minorPositions, 3));
        const minorMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
        group.add(new THREE.LineSegments(minorGeo, minorMat));

        // Major grid lines
        const majorGeo = new THREE.BufferGeometry();
        const majorPositions: number[] = [];
        const majorStep = spacing * majorInterval;

        for (let i = -halfSize; i <= halfSize; i += majorStep) {
            if (i === 0) continue; // skip center lines
            majorPositions.push(-halfSize, i, 0, halfSize, i, 0);
            majorPositions.push(i, -halfSize, 0, i, halfSize, 0);
        }

        majorGeo.setAttribute('position', new THREE.Float32BufferAttribute(majorPositions, 3));
        const majorMat = new THREE.LineBasicMaterial({ color: majorColor, transparent: true, opacity: majorOpacity });
        group.add(new THREE.LineSegments(majorGeo, majorMat));

        // Center lines (X and Y axes on grid)
        const centerGeo = new THREE.BufferGeometry();
        centerGeo.setAttribute('position', new THREE.Float32BufferAttribute([
            -halfSize, 0, 0, halfSize, 0, 0, // X center line
            0, -halfSize, 0, 0, halfSize, 0,  // Y center line
        ], 3));
        const centerMat = new THREE.LineBasicMaterial({ color: centerColor, transparent: true, opacity: 0.7 });
        group.add(new THREE.LineSegments(centerGeo, centerMat));

        return group;
    }

    // ===== World Axis at Origin =====
    private createWorldAxis(): THREE.Group {
        const group = new THREE.Group();
        group.name = '__worldAxis__';

        const length = 5;
        const createAxisLine = (dir: THREE.Vector3, color: number) => {
            const geo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3().copy(dir).multiplyScalar(length),
            ]);
            const mat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
            return new THREE.Line(geo, mat);
        };

        // X = Red, Y = Green, Z = Blue
        group.add(createAxisLine(new THREE.Vector3(1, 0, 0), AXIS_COLORS.x));
        group.add(createAxisLine(new THREE.Vector3(0, 1, 0), AXIS_COLORS.y));
        group.add(createAxisLine(new THREE.Vector3(0, 0, 1), AXIS_COLORS.z));

        // Small arrowheads
        const coneSize = 0.15;
        const addCone = (pos: THREE.Vector3, dir: THREE.Vector3, color: number) => {
            const cone = new THREE.Mesh(
                new THREE.ConeGeometry(coneSize, coneSize * 3, 8),
                new THREE.MeshBasicMaterial({ color })
            );
            cone.position.copy(pos);
            // Orient cone to point in direction
            const quat = new THREE.Quaternion();
            const up = new THREE.Vector3(0, 1, 0);
            quat.setFromUnitVectors(up, dir.clone().normalize());
            cone.quaternion.copy(quat);
            group.add(cone);
        };

        addCone(new THREE.Vector3(length, 0, 0), new THREE.Vector3(1, 0, 0), AXIS_COLORS.x);
        addCone(new THREE.Vector3(0, length, 0), new THREE.Vector3(0, 1, 0), AXIS_COLORS.y);
        addCone(new THREE.Vector3(0, 0, length), new THREE.Vector3(0, 0, 1), AXIS_COLORS.z);

        return group;
    }

    // ===== Load Geometry =====
    loadGeometries(geometries: GeometryData[]) {
        // Clear existing
        this.clearModel();

        let loaded = 0;
        let skipped = 0;

        for (const geo of geometries) {
            try {
                // Skip geometry with no data
                if (!geo.positions || geo.positions.length === 0 ||
                    !geo.indices || geo.indices.length === 0) {
                    skipped++;
                    continue;
                }

                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(geo.positions, 3));
                if (geo.normals && geo.normals.length > 0) {
                    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(geo.normals, 3));
                }
                geometry.setIndex(new THREE.BufferAttribute(geo.indices, 1));

                // Validate bounding sphere — skip corrupt geometry
                geometry.computeBoundingSphere();
                if (!geometry.boundingSphere ||
                    !isFinite(geometry.boundingSphere.radius) ||
                    isNaN(geometry.boundingSphere.center.x)) {
                    geometry.dispose();
                    skipped++;
                    continue;
                }

                const material = new THREE.MeshPhongMaterial({
                    color: new THREE.Color(geo.color.r, geo.color.g, geo.color.b),
                    transparent: geo.color.a < 1,
                    opacity: geo.color.a,
                    side: THREE.DoubleSide,
                });

                const mesh = new THREE.Mesh(geometry, material);
                mesh.userData.expressID = geo.expressID;

                // Apply the placement matrix exactly as web-ifc provides it,
                // using mesh.matrix directly (same as official web-ifc-three examples).
                if (geo.flatTransformation && geo.flatTransformation.length === 16) {
                    const mat = new THREE.Matrix4();
                    mat.fromArray(geo.flatTransformation);

                    // Skip meshes with degenerate transforms (NaN, Infinity)
                    const elems = mat.elements;
                    if (elems.some((v: number) => !isFinite(v))) {
                        geometry.dispose();
                        material.dispose();
                        skipped++;
                        continue;
                    }

                    mesh.matrix = mat;
                    mesh.matrixAutoUpdate = false;
                }

                this.modelGroup.add(mesh);
                this.meshMap.set(geo.expressID, mesh);
                this.originalMaterials.set(geo.expressID, material);
                loaded++;
            } catch (err) {
                console.warn('[SceneManager] Skipping corrupt geometry expressID=', geo.expressID, err);
                skipped++;
            }
        }

        console.log(`[SceneManager] Loaded ${loaded} geometries, skipped ${skipped}`);

        // web-ifc internally applies a NormalizeIFC matrix that converts
        // IFC's Z-up coordinates to Y-up (standard for most 3D engines).
        // Our scene uses Z-up (AEC / Rhino convention), so rotate the
        // entire model group +90° around X to convert Y-up → Z-up.
        this.modelGroup.rotation.x = Math.PI / 2;
        this.modelGroup.updateMatrixWorld(true);

        // Fit view
        this.fitToModel();
    }

    clearModel() {
        this.modelGroup.clear();
        this.modelGroup.rotation.set(0, 0, 0);
        this.modelGroup.updateMatrixWorld(true);
        this.meshMap.clear();
        this.originalMaterials.clear();
    }

    // ===== Camera =====
    fitToModel() {
        const box = new THREE.Box3().setFromObject(this.modelGroup);
        if (box.isEmpty()) return;

        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Guard against degenerate bounding box (NaN / Infinity)
        if (!isFinite(center.x) || !isFinite(center.y) || !isFinite(center.z) ||
            !isFinite(size.x) || !isFinite(size.y) || !isFinite(size.z)) {
            console.warn('[SceneManager] fitToModel: degenerate bounding box, resetting camera');
            this.controls.target.set(0, 0, 0);
            this.camera.position.set(20, 20, 20);
            this.controls.update();
            return;
        }

        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim === 0) return;
        const distance = maxDim * 1.5;

        this.controls.target.copy(center);
        this.camera.position.set(
            center.x + distance * 0.5,
            center.y + distance * 0.5,
            center.z + distance * 0.5
        );
        this.camera.lookAt(center);
        this.controls.update();

        // Update grid size to match model
        this.updateWorldAxis(maxDim);
    }

    private updateWorldAxis(modelSize: number) {
        // Scale world axis to be visible relative to model
        const scale = Math.max(modelSize * 0.1, 5);
        this.worldAxisGroup.scale.setScalar(scale / 5);
    }

    setViewPreset(preset: ViewPreset) {
        const config = CAMERA_PRESETS[preset];
        const box = new THREE.Box3().setFromObject(this.modelGroup);
        const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
        const size = box.isEmpty() ? new THREE.Vector3(10, 10, 10) : box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 1.5;

        const dir = new THREE.Vector3(...config.position).normalize();
        this.camera.position.copy(center.clone().add(dir.multiplyScalar(distance)));

        // For top view the camera looks straight down the Z axis, which is
        // collinear with the global up (0,0,1). OrbitControls can't handle
        // that, so we use Y-up temporarily for the snap but then nudge the
        // camera very slightly off-axis so that when the user orbits, the
        // global Z-up convention is restored and orbiting feels natural.
        if (preset === 'top') {
            this.camera.up.set(0, 1, 0);
            this.controls.target.copy(center);
            this.controls.update();
            // Nudge the camera a tiny fraction off the pure Z axis so
            // OrbitControls can re-derive Z-up on subsequent interactions.
            this.camera.position.x += distance * 0.0001;
            this.camera.up.set(0, 0, 1);
        } else {
            this.camera.up.set(0, 0, 1);
            this.controls.target.copy(center);
        }
        this.controls.update();
    }

    setProjection(mode: ProjectionMode) {
        const position = this.camera.position.clone();
        const target = this.controls.target.clone();

        if (mode === 'perspective') {
            this.camera = this.perspectiveCamera;
        } else {
            this.camera = this.orthographicCamera;
            // Match ortho camera frustum to current view
            const distance = position.distanceTo(target);
            const aspect = this.container.clientWidth / this.container.clientHeight;
            const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(30));
            this.orthographicCamera.left = -halfHeight * aspect;
            this.orthographicCamera.right = halfHeight * aspect;
            this.orthographicCamera.top = halfHeight;
            this.orthographicCamera.bottom = -halfHeight;
            this.orthographicCamera.updateProjectionMatrix();
        }

        this.camera.position.copy(position);
        this.camera.up.set(0, 0, 1);
        this.controls.object = this.camera;
        this.controls.target.copy(target);
        this.controls.update();

        // Update section tool camera reference for TransformControls
        if (this.sectionTool) this.sectionTool.updateCamera(this.camera);
    }

    setDisplayMode(mode: DisplayMode) {
        this.meshMap.forEach((mesh, id) => {
            const mat = this.originalMaterials.get(id);
            if (!mat) return;

            if (mesh.material === this.selectionMaterial) return; // don't change selected

            if (mode === 'wireframe') {
                (mat as THREE.MeshPhongMaterial).wireframe = true;
            } else {
                (mat as THREE.MeshPhongMaterial).wireframe = false;
            }
        });
    }

    // ===== Visibility =====
    setGridVisible(visible: boolean) {
        this.gridGroup.visible = visible;
    }

    setWorldAxisVisible(visible: boolean) {
        this.worldAxisGroup.visible = visible;
    }

    hideElements(ids: number[]) {
        for (const id of ids) {
            const mesh = this.meshMap.get(id);
            if (mesh) mesh.visible = false;
        }
    }

    showAllElements() {
        this.meshMap.forEach((mesh) => {
            mesh.visible = true;
        });
    }

    isolateElements(ids: Set<number>) {
        this.meshMap.forEach((mesh, id) => {
            mesh.visible = ids.has(id);
        });
    }

    // ===== Selection =====
    highlightSelected(selectedIDs: Set<number>) {
        // Restore all to original
        this.meshMap.forEach((mesh, id) => {
            const original = this.originalMaterials.get(id);
            if (original) {
                mesh.material = original;
            }
        });

        // Apply selection material
        selectedIDs.forEach((id) => {
            const mesh = this.meshMap.get(id);
            if (mesh) {
                mesh.material = this.selectionMaterial;
            }
        });
    }

    zoomToSelection(selectedIDs: Set<number>) {
        if (selectedIDs.size === 0) return;

        const box = new THREE.Box3();
        selectedIDs.forEach((id) => {
            const mesh = this.meshMap.get(id);
            if (mesh && mesh.visible) {
                box.expandByObject(mesh);
            }
        });

        if (box.isEmpty()) return;

        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = Math.max(maxDim * 2, 5);

        const direction = this.camera.position.clone().sub(this.controls.target).normalize();
        this.camera.position.copy(center.clone().add(direction.multiplyScalar(distance)));
        this.controls.target.copy(center);
        this.controls.update();
    }

    // ===== Picking =====
    private onClick = (event: MouseEvent) => {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.modelGroup.children, false);

        const selectionStore = useSelectionStore.getState();

        if (intersects.length > 0) {
            const firstHit = intersects[0].object;
            const expressID = firstHit.userData.expressID;

            if (expressID !== undefined) {
                if (event.ctrlKey || event.metaKey) {
                    selectionStore.toggleSelect(expressID);
                } else {
                    selectionStore.select(expressID);
                }
            }
        } else if (!event.ctrlKey && !event.metaKey) {
            selectionStore.clearSelection();
        }
    };

    private onMouseMove = (event: MouseEvent) => {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    // ===== Resize =====
    private handleResize() {
        if (this.disposed) return;
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        if (w === 0 || h === 0) return;

        const aspect = w / h;

        this.perspectiveCamera.aspect = aspect;
        this.perspectiveCamera.updateProjectionMatrix();

        const frustumSize = 50;
        this.orthographicCamera.left = -frustumSize * aspect;
        this.orthographicCamera.right = frustumSize * aspect;
        this.orthographicCamera.top = frustumSize;
        this.orthographicCamera.bottom = -frustumSize;
        this.orthographicCamera.updateProjectionMatrix();

        this.renderer.setSize(w, h);
    }

    // ===== Axis Helper (Corner Widget — synced with main camera Z-up) =====

    /**
     * Create a text sprite for axis labels.
     */
    private makeAxisLabel(text: string, color: number): THREE.Sprite {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, size, size);
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
        ctx.fillText(text, size / 2, size / 2);

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(0.5, 0.5, 0.5);
        return sprite;
    }

    /**
     * Build the axis helper scene once (lazy).  
     * Uses the same Z-up convention and colours as the world axis.
     */
    private ensureAxisHelperScene(canvas: HTMLCanvasElement) {
        if (this.axisHelperScene) return;

        const size = 120;

        // Renderer — reused across frames
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setSize(size, size);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.axisHelperRenderer = renderer;

        // Scene
        const scene = new THREE.Scene();
        this.axisHelperScene = scene;

        // Camera — must share the same up vector as the main viewport
        // Use a wide FOV so axes + labels never get cropped at canvas edges.
        const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
        camera.up.set(0, 0, 1); // Z-up to match main cameras
        this.axisHelperCamera = camera;

        // --- Custom axis lines (matching world axis colours) ---
        const axisLen = 1.2;
        const createLine = (dir: THREE.Vector3, color: number) => {
            const geo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                dir.clone().multiplyScalar(axisLen),
            ]);
            const mat = new THREE.LineBasicMaterial({ color, linewidth: 2, depthTest: false });
            return new THREE.Line(geo, mat);
        };

        scene.add(createLine(new THREE.Vector3(1, 0, 0), AXIS_COLORS.x));
        scene.add(createLine(new THREE.Vector3(0, 1, 0), AXIS_COLORS.y));
        scene.add(createLine(new THREE.Vector3(0, 0, 1), AXIS_COLORS.z));

        // Small cone arrowheads
        const coneR = 0.08;
        const coneH = 0.25;
        const addCone = (pos: THREE.Vector3, dir: THREE.Vector3, color: number) => {
            const cone = new THREE.Mesh(
                new THREE.ConeGeometry(coneR, coneH, 8),
                new THREE.MeshBasicMaterial({ color, depthTest: false }),
            );
            cone.position.copy(pos);
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
            cone.quaternion.copy(q);
            scene.add(cone);
        };

        addCone(new THREE.Vector3(axisLen, 0, 0), new THREE.Vector3(1, 0, 0), AXIS_COLORS.x);
        addCone(new THREE.Vector3(0, axisLen, 0), new THREE.Vector3(0, 1, 0), AXIS_COLORS.y);
        addCone(new THREE.Vector3(0, 0, axisLen), new THREE.Vector3(0, 0, 1), AXIS_COLORS.z);

        // Axis text labels
        const labelOffset = axisLen + 0.35;
        const xLabel = this.makeAxisLabel('X', AXIS_COLORS.x);
        xLabel.position.set(labelOffset, 0, 0);
        scene.add(xLabel);

        const yLabel = this.makeAxisLabel('Y', AXIS_COLORS.y);
        yLabel.position.set(0, labelOffset, 0);
        scene.add(yLabel);

        const zLabel = this.makeAxisLabel('Z', AXIS_COLORS.z);
        zLabel.position.set(0, 0, labelOffset);
        scene.add(zLabel);

        // Small sphere at origin for visual anchor
        const dot = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x888888, depthTest: false }),
        );
        scene.add(dot);
    }

    /**
     * Render the corner axis helper, synced to the main camera orientation.
     * Called every frame from the Viewport component.
     */
    renderAxisHelper(canvas: HTMLCanvasElement) {
        this.ensureAxisHelperScene(canvas);

        const camera = this.axisHelperCamera!;
        const renderer = this.axisHelperRenderer!;
        const scene = this.axisHelperScene!;

        // Position the mini-camera so it always looks at the origin from the
        // same relative direction as the main camera looks at its target.
        const mainCam = this.camera;
        const dir = new THREE.Vector3()
            .subVectors(mainCam.position, this.controls.target)
            .normalize();

        const dist = 4.0;
        camera.position.copy(dir.multiplyScalar(dist));
        camera.up.set(0, 0, 1);
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
    }

    // ===== Render Loop =====
    private animate = () => {
        if (this.disposed) return;
        this.animationFrameId = requestAnimationFrame(this.animate);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    };

    // ===== Cleanup =====
    dispose() {
        this.disposed = true;

        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
        }

        this.renderer.domElement.removeEventListener('click', this.onClick);
        this.renderer.domElement.removeEventListener('mousemove', this.onMouseMove);

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        this.controls.dispose();
        this.renderer.dispose();

        // Dispose section tool
        if (this.sectionTool) {
            this.sectionTool.dispose();
            this.sectionTool = null;
        }

        // Dispose axis helper renderer
        if (this.axisHelperRenderer) {
            this.axisHelperRenderer.dispose();
            this.axisHelperRenderer = null;
        }
        if (this.axisHelperScene) {
            this.axisHelperScene.traverse((obj) => {
                if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
                    obj.geometry?.dispose();
                    const mat = (obj as any).material;
                    if (mat) {
                        if (mat.map) mat.map.dispose();
                        mat.dispose();
                    }
                }
                if (obj instanceof THREE.Sprite) {
                    (obj.material as THREE.SpriteMaterial).map?.dispose();
                    obj.material.dispose();
                }
            });
            this.axisHelperScene = null;
        }
        this.axisHelperCamera = null;

        this.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry.dispose();
                if (Array.isArray(obj.material)) {
                    obj.material.forEach((m) => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });

        if (this.container.contains(this.renderer.domElement)) {
            this.container.removeChild(this.renderer.domElement);
        }
    }

    getMeshByExpressID(id: number): THREE.Mesh | undefined {
        return this.meshMap.get(id);
    }

    /**
     * Compute the world-space bounding box for an element.
     * Returns position (center) and size (width/height/depth) in metres,
     * or null if the element has no geometry.
     */
    getElementBounds(expressID: number): { position: { x: number; y: number; z: number }; size: { width: number; height: number; depth: number } } | null {
        const mesh = this.meshMap.get(expressID);
        if (!mesh) return null;

        const box = new THREE.Box3().setFromObject(mesh);
        if (box.isEmpty()) return null;

        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        return {
            position: { x: center.x, y: center.y, z: center.z },
            size: { width: size.x, height: size.y, depth: size.z },
        };
    }
}
