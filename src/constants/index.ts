import { Discipline } from '@/types';

// ===== Discipline Mapping =====
export const DISCIPLINE_MAP: Record<string, Discipline> = {
    // Architecture
    IfcWall: 'Architecture',
    IfcWallStandardCase: 'Architecture',
    IfcDoor: 'Architecture',
    IfcWindow: 'Architecture',
    IfcSlab: 'Architecture',
    IfcRoof: 'Architecture',
    IfcStair: 'Architecture',
    IfcStairFlight: 'Architecture',
    IfcRailing: 'Architecture',
    IfcCurtainWall: 'Architecture',
    IfcSpace: 'Architecture',
    IfcCovering: 'Architecture',
    IfcPlate: 'Architecture',
    IfcMember: 'Architecture',
    IfcBuildingElementProxy: 'Architecture',
    // Structure
    IfcBeam: 'Structure',
    IfcColumn: 'Structure',
    IfcFooting: 'Structure',
    IfcPile: 'Structure',
    IfcReinforcingBar: 'Structure',
    IfcReinforcingMesh: 'Structure',
    IfcTendon: 'Structure',
    IfcTendonAnchor: 'Structure',
    // MEP
    IfcPipeSegment: 'MEP',
    IfcPipeFitting: 'MEP',
    IfcDuctSegment: 'MEP',
    IfcDuctFitting: 'MEP',
    IfcFlowTerminal: 'MEP',
    IfcFlowFitting: 'MEP',
    IfcFlowSegment: 'MEP',
    IfcFlowController: 'MEP',
    IfcFlowMovingDevice: 'MEP',
    IfcFlowStorageDevice: 'MEP',
    IfcFlowTreatmentDevice: 'MEP',
    IfcEnergyConversionDevice: 'MEP',
    IfcDistributionChamberElement: 'MEP',
    IfcCableCarrierSegment: 'MEP',
    IfcCableSegment: 'MEP',
};

export function getDiscipline(ifcClass: string): Discipline {
    return DISCIPLINE_MAP[ifcClass] || 'Unknown';
}

// ===== Pset_*Common families =====
export const PSET_COMMON_REGEX = /^Pset_\w+Common$/;

export function isPsetCommon(psetName: string): boolean {
    return PSET_COMMON_REGEX.test(psetName);
}

// Known Pset_*Common families
export const KNOWN_PSET_COMMON = [
    'Pset_WallCommon',
    'Pset_DoorCommon',
    'Pset_WindowCommon',
    'Pset_SlabCommon',
    'Pset_BeamCommon',
    'Pset_ColumnCommon',
    'Pset_RoofCommon',
    'Pset_StairCommon',
    'Pset_RailingCommon',
    'Pset_CurtainWallCommon',
    'Pset_CoveringCommon',
    'Pset_PlateCommon',
    'Pset_MemberCommon',
    'Pset_PipeSegmentCommon',
    'Pset_DuctSegmentCommon',
    'Pset_SpaceCommon',
    'Pset_BuildingElementProxyCommon',
];

// ===== Grid Settings =====
export const GRID_DEFAULTS = {
    spacing: 1,          // 1 meter
    majorInterval: 5,    // every 5 minors = 5m
    size: 200,           // 200m total grid
    opacity: 0.3,
    majorOpacity: 0.5,
    color: 0x888888,
    majorColor: 0x444444,
    centerColor: 0x222222,
};

// ===== Axis Colors (Architecture Convention) =====
export const AXIS_COLORS = {
    x: 0xff0000, // Red
    y: 0x00ff00, // Green (not blue — architecture convention: Z=Blue)
    z: 0x0000ff, // Blue
};

// ===== Camera Presets =====
export const CAMERA_PRESETS = {
    top: { position: [0, 0, 50], target: [0, 0, 0], up: [0, 1, 0] },
    front: { position: [0, -50, 0], target: [0, 0, 0], up: [0, 0, 1] },
    back: { position: [0, 50, 0], target: [0, 0, 0], up: [0, 0, 1] },
    left: { position: [-50, 0, 0], target: [0, 0, 0], up: [0, 0, 1] },
    right: { position: [50, 0, 0], target: [0, 0, 0], up: [0, 0, 1] },
} as const;

// ===== Selection Colors =====
export const SELECTION_COLOR = 0x4488ff;
export const SELECTION_OPACITY = 0.5;

// ===== IFC Type IDs (web-ifc constants) =====
export const IFC_TYPES = {
    IFCPROJECT: 103090709,
    IFCSITE: 4097777520,
    IFCBUILDING: 4031249490,
    IFCBUILDINGSTOREY: 3124254112,
    IFCSPACE: 3856911033,
    IFCWALL: 2391406946,
    IFCWALLSTANDARDCASE: 3512223829,
    IFCDOOR: 395920057,
    IFCWINDOW: 3304561284,
    IFCSLAB: 1529196076,
    IFCBEAM: 753842376,
    IFCCOLUMN: 843113511,
    IFCROOF: 2016517767,
    IFCSTAIR: 331165859,
    IFCRAILING: 2262370178,
    IFCCURTAINWALL: 3495092785,
    IFCFOOTING: 900683007,
    IFCPILE: 1687234759,
    IFCREINFORCINGBAR: 979691226,
    IFCRELDEFINESBYPROPERTIES: 4186316022,
    IFCPROPERTYSET: 1451395588,
    IFCPROPERTYSINGLEVALUE: 3650150729,
    IFCRELCONTAINEDINSPATIALSTRUCTURE: 3242617779,
    IFCRELAGGREGATES: 160246688,
    IFCPIPESEGMENT: 3612865200,
    IFCDUCTSEGMENT: 3518393246,
    IFCFLOWTERMINAL: 2058353004,
    IFCFLOWFITTING: 4278956645,
    IFCCOVERING: 1973544240,
    IFCPLATE: 3171933400,
    IFCMEMBER: 1073191201,
    IFCBUILDINGELEMENTPROXY: 1095909175,
} as const;

// ===== Performance =====
export const CHUNK_SIZE = 5000; // elements per geometry chunk
export const MAX_MEMORY_LOW_MODE = 512 * 1024 * 1024; // 512MB
export const WORKER_PARSE_CHUNK = 10000; // lines per parse chunk
