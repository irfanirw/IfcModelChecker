import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import type {
    IfcElement,
    SpatialNode,
    TypeGroup,
    ModelInfo,
    ViewState,
    FilterState,
    ValidationResult,
    ValidationIssue,
    RulePack,
    IDSSpecification,
    EditAction,
    BatchEditOperation,
    PropertyValue,
    PropertySet,
} from '@/types';

// Enable Immer MapSet plugin for Map/Set support
enableMapSet();

// ===== Model Store =====
interface ModelState {
    modelInfo: ModelInfo | null;
    elements: Map<number, IfcElement>;
    geometries: any[];
    spatialTree: SpatialNode | null;
    typeGroups: TypeGroup[];
    levels: string[];
    zones: string[];
    ifcClasses: string[];
    isLoading: boolean;
    loadProgress: number;
    loadError: string | null;
    originalIfcText: string | null;

    setModelInfo: (info: ModelInfo) => void;
    setElements: (elements: Map<number, IfcElement>) => void;
    addElement: (element: IfcElement) => void;
    setGeometries: (geometries: any[]) => void;
    setSpatialTree: (tree: SpatialNode) => void;
    setTypeGroups: (groups: TypeGroup[]) => void;
    setLevels: (levels: string[]) => void;
    setZones: (zones: string[]) => void;
    setIfcClasses: (classes: string[]) => void;
    setLoading: (loading: boolean) => void;
    setLoadProgress: (progress: number) => void;
    setLoadError: (error: string | null) => void;
    setOriginalIfcText: (text: string) => void;
    updatePropertyValue: (
        elementID: number,
        psetName: string,
        propertyName: string,
        value: PropertyValue
    ) => void;
    reset: () => void;
}

const initialModelState = {
    modelInfo: null,
    elements: new Map<number, IfcElement>(),
    geometries: [] as any[],
    spatialTree: null,
    typeGroups: [],
    levels: [],
    zones: [],
    ifcClasses: [],
    isLoading: false,
    loadProgress: 0,
    loadError: null,
    originalIfcText: null,
};

export const useModelStore = create<ModelState>()(
    immer((set) => ({
        ...initialModelState,

        setModelInfo: (info) => set((s) => { s.modelInfo = info; }),
        setElements: (elements) => set((s) => { s.elements = elements; }),
        addElement: (element) =>
            set((s) => {
                s.elements.set(element.expressID, element);
            }),
        setGeometries: (geometries) => set((s) => { s.geometries = geometries; }),
        setSpatialTree: (tree) => set((s) => { s.spatialTree = tree; }),
        setTypeGroups: (groups) => set((s) => { s.typeGroups = groups; }),
        setLevels: (levels) => set((s) => { s.levels = levels; }),
        setZones: (zones) => set((s) => { s.zones = zones; }),
        setIfcClasses: (classes) => set((s) => { s.ifcClasses = classes; }),
        setLoading: (loading) => set((s) => { s.isLoading = loading; }),
        setLoadProgress: (progress) => set((s) => { s.loadProgress = progress; }),
        setLoadError: (error) => set((s) => { s.loadError = error; }),
        setOriginalIfcText: (text) => set((s) => { s.originalIfcText = text; }),
        updatePropertyValue: (elementID, psetName, propertyName, value) =>
            set((s) => {
                const el = s.elements.get(elementID);
                if (!el) return;
                const pset = el.psets.find((p: PropertySet) => p.name === psetName);
                if (!pset) return;
                const prop = pset.properties.find((p) => p.name === propertyName);
                if (prop) {
                    prop.value = value;
                    prop.modified = true;
                }
            }),
        reset: () =>
            set((s) => {
                Object.assign(s, initialModelState);
                s.elements = new Map();
                s.geometries = [];
            }),
    }))
);

// ===== Selection Store =====
interface SelectionState {
    selectedIDs: Set<number>;
    hoveredID: number | null;
    lastSelectedID: number | null;

    select: (id: number) => void;
    toggleSelect: (id: number) => void;
    addToSelection: (ids: number[]) => void;
    removeFromSelection: (ids: number[]) => void;
    clearSelection: () => void;
    setHovered: (id: number | null) => void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
    selectedIDs: new Set<number>(),
    hoveredID: null,
    lastSelectedID: null,

    select: (id) =>
        set(() => ({
            selectedIDs: new Set([id]),
            lastSelectedID: id,
        })),
    toggleSelect: (id) =>
        set((s) => {
            const next = new Set(s.selectedIDs);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return { selectedIDs: next, lastSelectedID: id };
        }),
    addToSelection: (ids) =>
        set((s) => {
            const next = new Set(s.selectedIDs);
            ids.forEach((id) => next.add(id));
            return { selectedIDs: next, lastSelectedID: ids[ids.length - 1] ?? s.lastSelectedID };
        }),
    removeFromSelection: (ids) =>
        set((s) => {
            const next = new Set(s.selectedIDs);
            ids.forEach((id) => next.delete(id));
            return { selectedIDs: next };
        }),
    clearSelection: () =>
        set(() => ({
            selectedIDs: new Set(),
            hoveredID: null,
            lastSelectedID: null,
        })),
    setHovered: (id) => set(() => ({ hoveredID: id })),
}));

// ===== View Store =====
interface ViewStoreState extends ViewState {
    setPreset: (preset: ViewState['preset']) => void;
    setProjection: (mode: ViewState['projection']) => void;
    setDisplay: (mode: ViewState['display']) => void;
    setGridVisible: (visible: boolean) => void;
    setWorldAxisVisible: (visible: boolean) => void;
}

export const useViewStore = create<ViewStoreState>()((set) => ({
    preset: null,
    projection: 'perspective',
    display: 'shaded',
    gridVisible: true,
    worldAxisVisible: true,

    setPreset: (preset) => set({ preset }),
    setProjection: (projection) => set({ projection }),
    setDisplay: (display) => set({ display }),
    setGridVisible: (gridVisible) => set({ gridVisible }),
    setWorldAxisVisible: (worldAxisVisible) => set({ worldAxisVisible }),
}));

// ===== Filter Store =====
interface FilterStoreState extends FilterState {
    setFilter: (partial: Partial<FilterState>) => void;
    resetFilters: () => void;
}

const initialFilter: FilterState = {
    discipline: 'All',
    level: 'All',
    zone: 'All',
    ifcClass: 'All',
    validationStatus: 'All',
    searchText: '',
};

export const useFilterStore = create<FilterStoreState>()((set) => ({
    ...initialFilter,
    setFilter: (partial) => set((s) => ({ ...s, ...partial })),
    resetFilters: () => set(initialFilter),
}));

// ===== Validation Store =====
interface ValidationState {
    rulePacks: RulePack[];
    idsSpecs: IDSSpecification[];
    activeRulePack: string | null;
    validationResult: ValidationResult | null;
    isValidating: boolean;
    validationProgress: number;

    addRulePack: (pack: RulePack) => void;
    addIdsSpec: (spec: IDSSpecification) => void;
    setActiveRulePack: (name: string | null) => void;
    setValidationResult: (result: ValidationResult | null) => void;
    setValidating: (v: boolean) => void;
    setValidationProgress: (p: number) => void;
    getIssuesForElement: (expressID: number) => ValidationIssue[];
}

export const useValidationStore = create<ValidationState>()((set, get) => ({
    rulePacks: [],
    idsSpecs: [],
    activeRulePack: null,
    validationResult: null,
    isValidating: false,
    validationProgress: 0,

    addRulePack: (pack) =>
        set((s) => ({ rulePacks: [...s.rulePacks, pack] })),
    addIdsSpec: (spec) =>
        set((s) => ({ idsSpecs: [...s.idsSpecs, spec] })),
    setActiveRulePack: (name) => set({ activeRulePack: name }),
    setValidationResult: (result) => set({ validationResult: result }),
    setValidating: (v) => set({ isValidating: v }),
    setValidationProgress: (p) => set({ validationProgress: p }),
    getIssuesForElement: (expressID) => {
        const result = get().validationResult;
        if (!result) return [];
        return result.issues.filter((i) => i.expressID === expressID);
    },
}));

// ===== Edit History Store =====
interface EditHistoryState {
    undoStack: EditAction[];
    redoStack: EditAction[];
    pushEdit: (action: EditAction) => void;
    undo: () => EditAction | undefined;
    redo: () => EditAction | undefined;
    clear: () => void;
}

export const useEditHistoryStore = create<EditHistoryState>()((set, get) => ({
    undoStack: [],
    redoStack: [],
    pushEdit: (action) =>
        set((s) => ({
            undoStack: [...s.undoStack, action],
            redoStack: [],
        })),
    undo: () => {
        const action = get().undoStack[get().undoStack.length - 1];
        if (!action) return undefined;
        set((s) => ({
            undoStack: s.undoStack.slice(0, -1),
            redoStack: [...s.redoStack, action],
        }));
        return action;
    },
    redo: () => {
        const action = get().redoStack[get().redoStack.length - 1];
        if (!action) return undefined;
        set((s) => ({
            redoStack: s.redoStack.slice(0, -1),
            undoStack: [...s.undoStack, action],
        }));
        return action;
    },
    clear: () => set({ undoStack: [], redoStack: [] }),
}));

// ===== UI Store (panels, dialogs) =====
interface UIState {
    leftBarTab: number; // 0=Spatial, 1=Type, 2=Search
    leftBarOpen: boolean;
    rightBarOpen: boolean;
    uploadDialogOpen: boolean;
    exportDialogOpen: boolean;
    validationDialogOpen: boolean;
    snackbar: { open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' };

    setLeftBarTab: (tab: number) => void;
    setLeftBarOpen: (open: boolean) => void;
    setRightBarOpen: (open: boolean) => void;
    setUploadDialogOpen: (open: boolean) => void;
    setExportDialogOpen: (open: boolean) => void;
    setValidationDialogOpen: (open: boolean) => void;
    showSnackbar: (message: string, severity?: 'success' | 'error' | 'warning' | 'info') => void;
    hideSnackbar: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
    leftBarTab: 0,
    leftBarOpen: true,
    rightBarOpen: true,
    uploadDialogOpen: false,
    exportDialogOpen: false,
    validationDialogOpen: false,
    snackbar: { open: false, message: '', severity: 'info' },

    setLeftBarTab: (tab) => set({ leftBarTab: tab }),
    setLeftBarOpen: (open) => set({ leftBarOpen: open }),
    setRightBarOpen: (open) => set({ rightBarOpen: open }),
    setUploadDialogOpen: (open) => set({ uploadDialogOpen: open }),
    setExportDialogOpen: (open) => set({ exportDialogOpen: open }),
    setValidationDialogOpen: (open) => set({ validationDialogOpen: open }),
    showSnackbar: (message, severity = 'info') =>
        set({ snackbar: { open: true, message, severity } }),
    hideSnackbar: () =>
        set((s) => ({ snackbar: { ...s.snackbar, open: false } })),
}));

// ===== Visibility Store (hide/isolate) =====
interface VisibilityState {
    hiddenIDs: Set<number>;
    isolatedIDs: Set<number> | null;

    hideElements: (ids: number[]) => void;
    unhideAll: () => void;
    isolateElements: (ids: number[]) => void;
    clearIsolation: () => void;
    isVisible: (id: number) => boolean;
}

export const useVisibilityStore = create<VisibilityState>()((set, get) => ({
    hiddenIDs: new Set(),
    isolatedIDs: null,

    hideElements: (ids) =>
        set((s) => {
            const next = new Set(s.hiddenIDs);
            ids.forEach((id) => next.add(id));
            return { hiddenIDs: next };
        }),
    unhideAll: () => set({ hiddenIDs: new Set(), isolatedIDs: null }),
    isolateElements: (ids) =>
        set(() => ({
            isolatedIDs: new Set(ids),
            hiddenIDs: new Set(),
        })),
    clearIsolation: () => set({ isolatedIDs: null }),
    isVisible: (id) => {
        const { hiddenIDs, isolatedIDs } = get();
        if (isolatedIDs !== null) return isolatedIDs.has(id);
        return !hiddenIDs.has(id);
    },
}));
