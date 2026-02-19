// ===== IFC Element Types =====
export interface IfcElement {
    expressID: number;
    globalId: string;
    name: string;
    tag: string;
    ifcClass: string;
    ifcType: number;
    level: string;
    zone: string;
    discipline: Discipline;
    psets: PropertySet[];
    modelID: number;
}

export type Discipline = 'Architecture' | 'Structure' | 'MEP' | 'Unknown';

export interface PropertySet {
    name: string;
    expressID: number;
    properties: Property[];
    isEditable: boolean; // true if Pset_*Common
}

export interface Property {
    name: string;
    expressID: number;
    value: PropertyValue;
    type: string; // IFC nominal type e.g. IfcLabel, IfcBoolean
    originalValue: PropertyValue;
    modified: boolean;
}

export type PropertyValue = string | number | boolean | null;

// ===== Spatial Tree =====
export interface SpatialNode {
    expressID: number;
    name: string;
    ifcClass: string;
    children: SpatialNode[];
    elementCount: number;
    /** true for individual building elements (walls, doors, etc.) at the leaf level */
    isLeaf?: boolean;
}

// ===== Type Tree =====
export interface TypeGroup {
    ifcClass: string;
    count: number;
    expressIDs: number[];
}

// ===== Validation =====
export type IssueSeverity = 'Error' | 'Warning';
export type IssueType = 'MissingParam' | 'MissingValue' | 'WrongValue' | 'Naming';

export interface ValidationIssue {
    id: string;
    discipline: Discipline;
    elementId: string; // Tag || Name || GlobalId
    globalId: string;
    expressID: number;
    ifcClass: string;
    name: string;
    level: string;
    zone: string;
    ruleId: string;
    ruleName: string;
    issueType: IssueType;
    propertyPath: string; // e.g. Pset_WallCommon.FireRating
    expected: string;
    actual: string;
    severity: IssueSeverity;
    suggestedFix?: string;
}

export interface ValidationResult {
    modelName: string;
    timestamp: string;
    schema: string;
    rulePackName: string;
    rulePackVersion: string;
    totalElements: number;
    totalIssues: number;
    errors: number;
    warnings: number;
    passed: number;
    issues: ValidationIssue[];
}

// ===== Rules =====
export interface RulePack {
    name: string;
    version: string;
    description: string;
    rules: ValidationRule[];
}

export interface ValidationRule {
    id: string;
    name: string;
    description: string;
    applicability: RuleApplicability;
    requirements: RuleRequirement[];
}

export interface RuleApplicability {
    ifcClasses?: string[];
    disciplines?: Discipline[];
    psetNames?: string[];
}

export interface RuleRequirement {
    psetName: string;
    propertyName: string;
    checkType: 'exists' | 'notEmpty' | 'equals' | 'inList' | 'range' | 'regex' | 'boolean';
    expected?: PropertyValue | PropertyValue[];
    min?: number;
    max?: number;
    pattern?: string;
    severity?: IssueSeverity;
}

// ===== IDS =====
export interface IDSSpecification {
    name: string;
    description?: string;
    ifcVersion?: string;
    applicability: IDSFacet[];
    requirements: IDSRequirement[];
}

export interface IDSFacet {
    type: 'entity' | 'attribute' | 'property' | 'classification' | 'material' | 'partOf';
    entityName?: string;
    attributeName?: string;
    psetName?: string;
    propertyName?: string;
    value?: string;
    pattern?: string;
}

export interface IDSRequirement {
    facet: IDSFacet;
    cardinality: 'required' | 'optional' | 'prohibited';
    description?: string;
}

// ===== View State =====
export type ViewPreset = 'top' | 'front' | 'back' | 'left' | 'right';
export type ProjectionMode = 'perspective' | 'parallel';
export type DisplayMode = 'shaded' | 'wireframe';
export type ValidationStatus = 'pass' | 'fail' | 'not-checked';

export interface ViewState {
    preset: ViewPreset | null;
    projection: ProjectionMode;
    display: DisplayMode;
    gridVisible: boolean;
    worldAxisVisible: boolean;
}

// ===== Batch Edit =====
export interface BatchEditOperation {
    psetName: string;
    propertyName: string;
    value: PropertyValue;
    mode: 'overwrite' | 'fillEmpty';
}

// ===== Model Info =====
export interface ModelInfo {
    fileName: string;
    fileSize: number;
    schema: string;
    description: string;
    headerComments: string[];
    originalText?: string; // for patch export
}

// ===== Edit History =====
export interface EditAction {
    elementIDs: number[];
    psetName: string;
    propertyName: string;
    oldValues: Map<number, PropertyValue>;
    newValue: PropertyValue;
    timestamp: number;
}

// ===== Search & Filter =====
export interface FilterState {
    discipline: Discipline | 'All';
    level: string | 'All';
    zone: string | 'All';
    ifcClass: string | 'All';
    validationStatus: ValidationStatus | 'All';
    searchText: string;
}
