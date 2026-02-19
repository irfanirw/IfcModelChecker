/**
 * IFC Parser Worker
 * Runs web-ifc in a Web Worker for non-blocking parsing
 */

// Catch unhandled errors/rejections so they're not silently swallowed
self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    console.error('[IFC Worker] Unhandled rejection:', event.reason);
    self.postMessage({
        type: 'error',
        message: String(event.reason?.message || event.reason || 'Unhandled rejection in worker'),
    });
});

// Worker message types
export interface ParseRequest {
    type: 'parse';
    fileBuffer: ArrayBuffer;
    wasmPath: string;
}

export interface ParseProgress {
    type: 'progress';
    percent: number;
    message: string;
}

export interface ParsedElement {
    expressID: number;
    globalId: string;
    name: string;
    tag: string;
    ifcClass: string;
    ifcType: number;
    level: string;
    zone: string;
    psets: ParsedPset[];
}

export interface ParsedPset {
    name: string;
    expressID: number;
    properties: ParsedProperty[];
}

export interface ParsedProperty {
    name: string;
    expressID: number;
    value: string | number | boolean | null;
    type: string;
}

export interface GeometryData {
    expressID: number;
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
    color: { r: number; g: number; b: number; a: number };
    flatTransformation: number[];
}

export interface ParseResult {
    type: 'result';
    elements: ParsedElement[];
    geometries: GeometryData[];
    spatialTree: any;
    headerComments: string[];
    schema: string;
    description: string;
}

export interface ParseError {
    type: 'error';
    message: string;
}

export type WorkerMessage = ParseRequest;
export type WorkerResponse = ParseProgress | ParseResult | ParseError;

// IFC type ID to class name mapping
const TYPE_MAP: Record<number, string> = {};

function initTypeMap() {
    // These will be populated by known IFC types
    const types: [number, string][] = [
        [2391406946, 'IfcWall'],
        [3512223829, 'IfcWallStandardCase'],
        [395920057, 'IfcDoor'],
        [3304561284, 'IfcWindow'],
        [1529196076, 'IfcSlab'],
        [753842376, 'IfcBeam'],
        [843113511, 'IfcColumn'],
        [2016517767, 'IfcRoof'],
        [331165859, 'IfcStair'],
        [2262370178, 'IfcRailing'],
        [3495092785, 'IfcCurtainWall'],
        [900683007, 'IfcFooting'],
        [1687234759, 'IfcPile'],
        [979691226, 'IfcReinforcingBar'],
        [3612865200, 'IfcPipeSegment'],
        [3518393246, 'IfcDuctSegment'],
        [2058353004, 'IfcFlowTerminal'],
        [4278956645, 'IfcFlowFitting'],
        [3856911033, 'IfcSpace'],
        [3124254112, 'IfcBuildingStorey'],
        [4031249490, 'IfcBuilding'],
        [4097777520, 'IfcSite'],
        [103090709, 'IfcProject'],
        [1973544240, 'IfcCovering'],
        [3171933400, 'IfcPlate'],
        [1073191201, 'IfcMember'],
        [1095909175, 'IfcBuildingElementProxy'],
        [4252922144, 'IfcStairFlight'],
        [3588315303, 'IfcOpeningElement'],
        [1281925730, 'IfcDistributionPort'],
    ];
    types.forEach(([id, name]) => {
        TYPE_MAP[id] = name;
    });
}

initTypeMap();

let ifcApi: any = null;

async function initIfcApi(wasmPath: string) {
    // Dynamic import web-ifc
    console.log('[IFC Worker] Importing web-ifc module...');
    const WebIfc = await import('web-ifc');
    console.log('[IFC Worker] web-ifc imported, creating IfcAPI instance...');
    ifcApi = new WebIfc.IfcAPI();
    // Second arg = true marks the path as absolute, preventing
    // web-ifc from prepending the worker script's own URL
    ifcApi.SetWasmPath(wasmPath, true);
    // Force single-threaded mode. When crossOriginIsolated is true
    // (COOP/COEP headers), web-ifc tries to use the multi-threaded
    // build which spawns a pthread worker (web-ifc-mt.worker.js).
    // That nested worker file isn't served by Vite, causing a silent
    // hang. Using forceSingleThread avoids the MT path entirely.
    console.log('[IFC Worker] Calling Init (forceSingleThread=true)...');
    await ifcApi.Init(undefined, true);
    console.log('[IFC Worker] IfcAPI initialized successfully');
    return ifcApi;
}

function getTypeName(typeId: number): string {
    return TYPE_MAP[typeId] || `IfcType_${typeId}`;
}

/**
 * Safely extract a string from a web-ifc property.
 * web-ifc properties can be plain strings, numbers, or objects like {value, type, name}.
 * This helper always returns a string.
 */
function str(prop: any, fallback = ''): string {
    if (prop == null) return fallback;
    // If it's already a primitive, coerce to string
    if (typeof prop === 'string') return prop || fallback;
    if (typeof prop === 'number') return String(prop);
    if (typeof prop === 'boolean') return String(prop);
    // web-ifc object: try .value first
    if (typeof prop === 'object') {
        if (prop.value != null) {
            const v = prop.value;
            if (typeof v === 'string') return v || fallback;
            if (typeof v === 'number' || typeof v === 'boolean') return String(v);
        }
        // last resort – don't return the raw object
        return fallback;
    }
    return fallback;
}

function extractProperties(api: any, modelID: number, elementID: number): ParsedPset[] {
    const psets: ParsedPset[] = [];

    try {
        const psetLines = api.GetLineIDsWithType(modelID, 4186316022); // IFCRELDEFINESBYPROPERTIES
        for (let i = 0; i < psetLines.size(); i++) {
            const relID = psetLines.get(i);
            const rel = api.GetLine(modelID, relID);
            if (!rel || !rel.RelatedObjects) continue;

            const relatedIDs: number[] = [];
            if (Array.isArray(rel.RelatedObjects)) {
                rel.RelatedObjects.forEach((obj: any) => {
                    if (obj && obj.value !== undefined) relatedIDs.push(obj.value);
                });
            }

            if (!relatedIDs.includes(elementID)) continue;

            const propDefRef = rel.RelatingPropertyDefinition;
            if (!propDefRef) continue;

            const propDefID = propDefRef.value !== undefined ? propDefRef.value : propDefRef;
            let propDef;
            try {
                propDef = api.GetLine(modelID, propDefID);
            } catch {
                continue;
            }

            if (!propDef || !propDef.Name) continue;

            const psetName = str(propDef.Name, '');
            const props: ParsedProperty[] = [];

            if (propDef.HasProperties) {
                const hasProps = Array.isArray(propDef.HasProperties)
                    ? propDef.HasProperties
                    : [propDef.HasProperties];

                for (const propRef of hasProps) {
                    const propID = propRef.value !== undefined ? propRef.value : propRef;
                    try {
                        const prop = api.GetLine(modelID, propID);
                        if (!prop || !prop.Name) continue;

                        let value: string | number | boolean | null = null;
                        let type = 'IfcLabel';

                        if (prop.NominalValue !== undefined && prop.NominalValue !== null) {
                            const nv = prop.NominalValue;
                            if (nv.value !== undefined) {
                                value = nv.value;
                            } else {
                                value = nv;
                            }
                            if (nv.type !== undefined) {
                                type = `IfcType_${nv.type}`;
                            }
                            if (nv.label) {
                                type = nv.label;
                            }
                        }

                        props.push({
                            name: str(prop.Name, ''),
                            expressID: propID,
                            value,
                            type,
                        });
                    } catch {
                        // skip bad prop
                    }
                }
            }

            psets.push({
                name: psetName,
                expressID: propDefID,
                properties: props,
            });
        }
    } catch (e) {
        console.warn('Error extracting psets for', elementID, e);
    }

    return psets;
}

function buildSpatialTree(api: any, modelID: number): { tree: any; containedIDs: Set<number> } {
    const aggregates = api.GetLineIDsWithType(modelID, 160246688); // IFCRELAGGREGATES
    const containment = api.GetLineIDsWithType(modelID, 3242617779); // IFCRELCONTAINEDINSPATIALSTRUCTURE

    const childMap = new Map<number, number[]>();
    const containedMap = new Map<number, number[]>();
    const allContainedIDs = new Set<number>();

    for (let i = 0; i < aggregates.size(); i++) {
        try {
            const rel = api.GetLine(modelID, aggregates.get(i));
            const parentID = rel.RelatingObject?.value;
            if (!parentID) continue;
            const children: number[] = [];
            if (Array.isArray(rel.RelatedObjects)) {
                rel.RelatedObjects.forEach((obj: any) => {
                    if (obj?.value) children.push(obj.value);
                });
            }
            childMap.set(parentID, [...(childMap.get(parentID) || []), ...children]);
        } catch { /* skip */ }
    }

    for (let i = 0; i < containment.size(); i++) {
        try {
            const rel = api.GetLine(modelID, containment.get(i));
            const parentID = rel.RelatingStructure?.value;
            if (!parentID) continue;
            const children: number[] = [];
            if (Array.isArray(rel.RelatedElements)) {
                rel.RelatedElements.forEach((obj: any) => {
                    if (obj?.value) children.push(obj.value);
                });
            }
            containedMap.set(parentID, [...(containedMap.get(parentID) || []), ...children]);
            children.forEach((cid) => allContainedIDs.add(cid));
        } catch { /* skip */ }
    }

    /**
     * Build a node for the spatial tree.
     * @param id        express ID of the IFC entity
     * @param ancestors Set of IDs on the current path from root → here (cycle detection)
     * @param depth     current depth – bail out at a sane limit to avoid runaway recursion
     */
    function buildNode(id: number, ancestors = new Set<number>(), depth = 0): any {
        // Guard against circular references (ancestor path only – siblings may reuse IDs)
        if (ancestors.has(id)) return null;
        // Hard depth limit to prevent runaway recursion on malformed models
        if (depth > 50) return null;

        let item;
        try {
            item = api.GetLine(modelID, id);
        } catch {
            return null;
        }
        if (!item) return null;

        const aggChildren = childMap.get(id) || [];
        const contChildren = containedMap.get(id) || [];

        // Create a NEW set for children so sibling branches don't interfere
        const childAncestors = new Set(ancestors);
        childAncestors.add(id);

        const childNodes = aggChildren
            .map((cid) => buildNode(cid, childAncestors, depth + 1))
            .filter(Boolean);

        // Build leaf nodes for contained elements (walls, doors, etc.)
        const leafNodes: any[] = [];
        for (const cid of contChildren) {
            if (childAncestors.has(cid)) continue; // cycle guard
            let el;
            try { el = api.GetLine(modelID, cid); } catch { continue; }
            if (!el) continue;
            leafNodes.push({
                expressID: cid,
                name: str(el.Name, `#${cid}`),
                ifcClass: getTypeName(el.type || 0),
                children: [],
                elementCount: 0,
                isLeaf: true,
            });
        }

        const allChildren = [...childNodes, ...leafNodes];
        const elementCount = contChildren.length + childNodes.reduce((sum: number, c: any) => sum + (c.elementCount || 0), 0);

        return {
            expressID: id,
            name: str(item.Name, `#${id}`),
            ifcClass: getTypeName(item.type || 0),
            children: allChildren,
            elementCount,
        };
    }

    // Find project root
    const projects = api.GetLineIDsWithType(modelID, 103090709);
    if (projects.size() > 0) {
        return { tree: buildNode(projects.get(0)), containedIDs: allContainedIDs };
    }
    return { tree: null, containedIDs: allContainedIDs };
}

function getStoreyMap(api: any, modelID: number): Map<number, string> {
    const map = new Map<number, string>();
    const containment = api.GetLineIDsWithType(modelID, 3242617779);

    for (let i = 0; i < containment.size(); i++) {
        try {
            const rel = api.GetLine(modelID, containment.get(i));
            const structRef = rel.RelatingStructure;
            if (!structRef) continue;
            const structID = structRef.value || structRef;
            const struct = api.GetLine(modelID, structID);
            if (!struct) continue;

            const structType = struct.type || 0;
            // IfcBuildingStorey = 3124254112
            if (structType === 3124254112) {
                const storeyName = str(struct.Name, `Storey #${structID}`);
                if (Array.isArray(rel.RelatedElements)) {
                    rel.RelatedElements.forEach((obj: any) => {
                        if (obj?.value) map.set(obj.value, storeyName);
                    });
                }
            }
        } catch { /* skip */ }
    }
    return map;
}

function getSpaceMap(api: any, modelID: number): Map<number, string> {
    const map = new Map<number, string>();
    const containment = api.GetLineIDsWithType(modelID, 3242617779);

    for (let i = 0; i < containment.size(); i++) {
        try {
            const rel = api.GetLine(modelID, containment.get(i));
            const structRef = rel.RelatingStructure;
            if (!structRef) continue;
            const structID = structRef.value || structRef;
            const struct = api.GetLine(modelID, structID);
            if (!struct) continue;

            // IfcSpace = 3856911033
            if ((struct.type || 0) === 3856911033) {
                const spaceName = str(struct.Name) || str(struct.LongName) || `Space #${structID}`;
                if (Array.isArray(rel.RelatedElements)) {
                    rel.RelatedElements.forEach((obj: any) => {
                        if (obj?.value) {
                            const existing = map.get(obj.value);
                            if (existing) {
                                map.set(obj.value, existing + ';' + spaceName);
                            } else {
                                map.set(obj.value, spaceName);
                            }
                        }
                    });
                }
            }
        } catch { /* skip */ }
    }
    return map;
}

function extractHeaderComments(fileText: string): string[] {
    const comments: string[] = [];
    const headerEnd = fileText.indexOf('ENDSEC;');
    if (headerEnd === -1) return comments;

    const headerSection = fileText.substring(0, headerEnd);
    const commentRegex = /\/\*[\s\S]*?\*\//g;
    let match;
    while ((match = commentRegex.exec(headerSection)) !== null) {
        comments.push(match[0]);
    }
    return comments;
}

function extractSchema(fileText: string): string {
    const match = fileText.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/);
    return match ? match[1] : 'Unknown';
}

function extractDescription(fileText: string): string {
    const match = fileText.match(/FILE_DESCRIPTION\s*\(\s*\(\s*'([^']+)'/);
    return match ? match[1] : '';
}

async function parseIfc(data: ArrayBuffer, wasmPath: string) {
    const api = await initIfcApi(wasmPath);
    const uint8 = new Uint8Array(data);

    // Decode for header analysis
    const decoder = new TextDecoder('utf-8');
    const headerText = decoder.decode(uint8.slice(0, Math.min(uint8.length, 50000)));

    const headerComments = extractHeaderComments(headerText);
    const schema = extractSchema(headerText);
    const description = extractDescription(headerText);

    self.postMessage({ type: 'progress', percent: 10, message: 'Opening model...' } as ParseProgress);

    const modelID = api.OpenModel(uint8);

    self.postMessage({ type: 'progress', percent: 30, message: 'Building spatial tree...' } as ParseProgress);

    let spatialTree: any = null;
    let containedIDs = new Set<number>();
    try {
        const result = buildSpatialTree(api, modelID);
        spatialTree = result.tree;
        containedIDs = result.containedIDs;
    } catch (e) {
        console.warn('[IFC Worker] Failed to build spatial tree:', e);
    }
    const storeyMap = getStoreyMap(api, modelID);
    const spaceMap = getSpaceMap(api, modelID);

    self.postMessage({ type: 'progress', percent: 50, message: 'Extracting elements...' } as ParseProgress);

    // Get all element types we care about
    const targetTypes = [
        2391406946, 3512223829, 395920057, 3304561284, 1529196076,
        753842376, 843113511, 2016517767, 331165859, 2262370178,
        3495092785, 900683007, 1687234759, 979691226, 3612865200,
        3518393246, 2058353004, 4278956645, 3856911033, 1973544240,
        3171933400, 1073191201, 1095909175, 4252922144,
    ];

    const elements: ParsedElement[] = [];
    const parsedIDs = new Set<number>();

    for (const typeId of targetTypes) {
        const lines = api.GetLineIDsWithType(modelID, typeId);
        for (let i = 0; i < lines.size(); i++) {
            const expressID = lines.get(i);
            if (parsedIDs.has(expressID)) continue;
            try {
                const item = api.GetLine(modelID, expressID);
                if (!item) continue;

                const globalId = str(item.GlobalId, '');
                const name = str(item.Name, '');
                const tag = str(item.Tag, '');
                const ifcClass = getTypeName(typeId);

                const psets = extractProperties(api, modelID, expressID);

                elements.push({
                    expressID,
                    globalId,
                    name,
                    tag,
                    ifcClass,
                    ifcType: typeId,
                    level: storeyMap.get(expressID) || '',
                    zone: spaceMap.get(expressID) || '',
                    psets,
                });
                parsedIDs.add(expressID);
            } catch (e) {
                console.warn('Error parsing element', expressID, e);
            }
        }
    }

    // Parse any contained elements that were not covered by targetTypes.
    // This ensures every element visible in the spatial tree is also in
    // the elements list and will show properties in the inspector.
    for (const expressID of containedIDs) {
        if (parsedIDs.has(expressID)) continue;
        try {
            const item = api.GetLine(modelID, expressID);
            if (!item) continue;
            // Skip if it doesn't look like a product (no GlobalId)
            if (!item.GlobalId) continue;

            const globalId = str(item.GlobalId, '');
            const name = str(item.Name, '');
            const tag = str(item.Tag, '');
            const ifcClass = getTypeName(item.type || 0);

            const psets = extractProperties(api, modelID, expressID);

            elements.push({
                expressID,
                globalId,
                name,
                tag,
                ifcClass,
                ifcType: item.type || 0,
                level: storeyMap.get(expressID) || '',
                zone: spaceMap.get(expressID) || '',
                psets,
            });
            parsedIDs.add(expressID);
        } catch {
            // skip
        }
    }

    self.postMessage({ type: 'progress', percent: 75, message: 'Loading geometry...' } as ParseProgress);

    // Extract geometry
    const geometries: GeometryData[] = [];
    api.StreamAllMeshes(modelID, (mesh: any) => {
        try {
            const placedGeometries = mesh.geometries;
            for (let i = 0; i < placedGeometries.size(); i++) {
                const placed = placedGeometries.get(i);
                let geo: any;
                try {
                    geo = api.GetGeometry(modelID, placed.geometryExpressID);
                } catch {
                    continue; // skip geometry that can't be retrieved
                }

                const vData = api.GetVertexArray(geo.GetVertexData(), geo.GetVertexDataSize());
                const iData = api.GetIndexArray(geo.GetIndexData(), geo.GetIndexDataSize());

                // Skip empty geometry
                if (!vData || vData.length === 0 || !iData || iData.length === 0) {
                    geo.delete();
                    continue;
                }

                // Vertex data: x,y,z, nx,ny,nz per vertex
                const positions = new Float32Array(vData.length / 2);
                const normals = new Float32Array(vData.length / 2);
                for (let v = 0; v < vData.length / 6; v++) {
                    positions[v * 3] = vData[v * 6];
                    positions[v * 3 + 1] = vData[v * 6 + 1];
                    positions[v * 3 + 2] = vData[v * 6 + 2];
                    normals[v * 3] = vData[v * 6 + 3];
                    normals[v * 3 + 1] = vData[v * 6 + 4];
                    normals[v * 3 + 2] = vData[v * 6 + 5];
                }

                geometries.push({
                    expressID: mesh.expressID,
                    positions,
                    normals,
                    indices: new Uint32Array(iData),
                    color: {
                        r: placed.color.x,
                        g: placed.color.y,
                        b: placed.color.z,
                        a: placed.color.w,
                    },
                    flatTransformation: Array.from(placed.flatTransformation),
                });

                geo.delete();
            }
        } catch (meshErr) {
            console.warn('[IFC Worker] Error processing mesh expressID=', mesh.expressID, meshErr);
        }
    });

    self.postMessage({ type: 'progress', percent: 95, message: 'Finalizing...' } as ParseProgress);

    api.CloseModel(modelID);

    return {
        elements,
        geometries,
        spatialTree,
        headerComments,
        schema,
        description,
    };
}

// Worker message handler
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;

    if (msg.type === 'parse') {
        try {
            console.log('[IFC Worker] Starting parse, wasmPath =', msg.wasmPath);
            const result = await parseIfc(msg.fileBuffer, msg.wasmPath);
            console.log('[IFC Worker] Parse complete —', result.elements.length, 'elements,', result.geometries.length, 'geometries');
            self.postMessage({
                type: 'result',
                ...result,
            } as ParseResult);
        } catch (err: any) {
            console.error('[IFC Worker] Parse error:', err);
            self.postMessage({
                type: 'error',
                message: err.message || 'Unknown parsing error',
            } as ParseError);
        }
    }
};
