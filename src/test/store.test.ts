import { describe, it, expect, beforeEach } from 'vitest';
import {
    useModelStore,
    useSelectionStore,
    useViewStore,
    useFilterStore,
    useEditHistoryStore,
    useUIStore,
    useVisibilityStore,
} from '@/store';
import type { IfcElement, EditAction } from '@/types';

function makeElement(id: number, name: string, modified = false): IfcElement {
    return {
        expressID: id,
        globalId: `guid-${id}`,
        name,
        tag: `tag-${id}`,
        ifcClass: 'IfcWall',
        ifcType: 2391406946,
        level: 'Level 1',
        zone: '',
        discipline: 'Architecture',
        psets: [
            {
                name: 'Pset_WallCommon',
                expressID: 100 + id,
                isEditable: true,
                properties: [
                    {
                        name: 'FireRating',
                        expressID: 200 + id,
                        value: modified ? '2HR' : '',
                        type: 'IfcLabel',
                        originalValue: '',
                        modified,
                    },
                ],
            },
        ],
        modelID: 0,
    };
}

describe('Zustand Stores', () => {
    describe('useModelStore', () => {
        beforeEach(() => {
            useModelStore.getState().reset();
        });

        it('should have initial empty state', () => {
            const state = useModelStore.getState();
            expect(state.modelInfo).toBeNull();
            expect(state.elements.size).toBe(0);
            expect(state.spatialTree).toBeNull();
            expect(state.isLoading).toBe(false);
        });

        it('should update loading state', () => {
            useModelStore.getState().setLoading(true);
            expect(useModelStore.getState().isLoading).toBe(true);
        });

        it('should set load progress', () => {
            useModelStore.getState().setLoadProgress(50);
            expect(useModelStore.getState().loadProgress).toBe(50);
        });

        it('should store elements in a Map', () => {
            const elements = new Map<number, IfcElement>();
            elements.set(1, makeElement(1, 'Wall 1'));
            useModelStore.getState().setElements(elements);
            expect(useModelStore.getState().elements.size).toBe(1);
            expect(useModelStore.getState().elements.get(1)?.name).toBe('Wall 1');
        });

        it('should add a single element', () => {
            useModelStore.getState().addElement(makeElement(1, 'Wall 1'));
            useModelStore.getState().addElement(makeElement(2, 'Wall 2'));
            expect(useModelStore.getState().elements.size).toBe(2);
        });

        it('should update a property value', () => {
            const elements = new Map<number, IfcElement>();
            elements.set(1, makeElement(1, 'Wall 1'));
            useModelStore.getState().setElements(elements);

            useModelStore.getState().updatePropertyValue(1, 'Pset_WallCommon', 'FireRating', '2HR');

            const updated = useModelStore.getState().elements.get(1);
            const prop = updated?.psets[0]?.properties[0];
            expect(prop?.value).toBe('2HR');
            expect(prop?.modified).toBe(true);
        });

        it('should not crash when updating non-existent element', () => {
            useModelStore.getState().updatePropertyValue(999, 'Pset_WallCommon', 'FireRating', '2HR');
            // No crash — just a no-op
        });

        it('should set levels and zones', () => {
            useModelStore.getState().setLevels(['Level 1', 'Level 2']);
            useModelStore.getState().setZones(['Zone A']);
            expect(useModelStore.getState().levels).toEqual(['Level 1', 'Level 2']);
            expect(useModelStore.getState().zones).toEqual(['Zone A']);
        });

        it('should reset to initial state', () => {
            useModelStore.getState().setLoading(true);
            useModelStore.getState().addElement(makeElement(1, 'Wall'));
            useModelStore.getState().reset();
            expect(useModelStore.getState().isLoading).toBe(false);
            expect(useModelStore.getState().elements.size).toBe(0);
        });
    });

    describe('useSelectionStore', () => {
        beforeEach(() => {
            useSelectionStore.getState().clearSelection();
        });

        it('should start with empty selection', () => {
            const state = useSelectionStore.getState();
            expect(state.selectedIDs.size).toBe(0);
            expect(state.hoveredID).toBeNull();
        });

        it('should select a single element', () => {
            useSelectionStore.getState().select(42);
            expect(useSelectionStore.getState().selectedIDs.has(42)).toBe(true);
            expect(useSelectionStore.getState().selectedIDs.size).toBe(1);
        });

        it('should replace selection on select()', () => {
            useSelectionStore.getState().select(1);
            useSelectionStore.getState().select(2);
            expect(useSelectionStore.getState().selectedIDs.size).toBe(1);
            expect(useSelectionStore.getState().selectedIDs.has(2)).toBe(true);
            expect(useSelectionStore.getState().selectedIDs.has(1)).toBe(false);
        });

        it('should toggle selection', () => {
            useSelectionStore.getState().select(1);
            useSelectionStore.getState().toggleSelect(1);
            expect(useSelectionStore.getState().selectedIDs.has(1)).toBe(false);
        });

        it('should toggle adding to selection', () => {
            useSelectionStore.getState().select(1);
            useSelectionStore.getState().toggleSelect(2);
            expect(useSelectionStore.getState().selectedIDs.size).toBe(2);
        });

        it('should add to selection', () => {
            useSelectionStore.getState().select(1);
            useSelectionStore.getState().addToSelection([2, 3]);
            expect(useSelectionStore.getState().selectedIDs.size).toBe(3);
        });

        it('should remove from selection', () => {
            useSelectionStore.getState().select(1);
            useSelectionStore.getState().addToSelection([2, 3]);
            useSelectionStore.getState().removeFromSelection([1]);
            expect(useSelectionStore.getState().selectedIDs.size).toBe(2);
            expect(useSelectionStore.getState().selectedIDs.has(2)).toBe(true);
        });

        it('should clear selection', () => {
            useSelectionStore.getState().select(1);
            useSelectionStore.getState().addToSelection([2]);
            useSelectionStore.getState().clearSelection();
            expect(useSelectionStore.getState().selectedIDs.size).toBe(0);
        });

        it('should set hovered ID', () => {
            useSelectionStore.getState().setHovered(5);
            expect(useSelectionStore.getState().hoveredID).toBe(5);
            useSelectionStore.getState().setHovered(null);
            expect(useSelectionStore.getState().hoveredID).toBeNull();
        });
    });

    describe('useViewStore', () => {
        beforeEach(() => {
            useViewStore.setState({
                preset: null,
                projection: 'perspective',
                display: 'shaded',
                gridVisible: true,
                worldAxisVisible: true,
            });
        });

        it('should default to perspective projection', () => {
            expect(useViewStore.getState().projection).toBe('perspective');
        });

        it('should default to shaded display', () => {
            expect(useViewStore.getState().display).toBe('shaded');
        });

        it('should default to grid visible', () => {
            expect(useViewStore.getState().gridVisible).toBe(true);
        });

        it('should set projection', () => {
            useViewStore.getState().setProjection('parallel');
            expect(useViewStore.getState().projection).toBe('parallel');
        });

        it('should set display mode', () => {
            useViewStore.getState().setDisplay('wireframe');
            expect(useViewStore.getState().display).toBe('wireframe');
        });

        it('should toggle grid visibility', () => {
            useViewStore.getState().setGridVisible(false);
            expect(useViewStore.getState().gridVisible).toBe(false);
        });

        it('should set world axis visibility', () => {
            useViewStore.getState().setWorldAxisVisible(false);
            expect(useViewStore.getState().worldAxisVisible).toBe(false);
        });

        it('should set preset', () => {
            useViewStore.getState().setPreset('top');
            expect(useViewStore.getState().preset).toBe('top');
        });
    });

    describe('useFilterStore', () => {
        beforeEach(() => {
            useFilterStore.getState().resetFilters();
        });

        it('should start with All filters', () => {
            const state = useFilterStore.getState();
            expect(state.discipline).toBe('All');
            expect(state.level).toBe('All');
            expect(state.zone).toBe('All');
            expect(state.ifcClass).toBe('All');
            expect(state.validationStatus).toBe('All');
            expect(state.searchText).toBe('');
        });

        it('should update discipline filter', () => {
            useFilterStore.getState().setFilter({ discipline: 'Architecture' });
            expect(useFilterStore.getState().discipline).toBe('Architecture');
        });

        it('should update search text', () => {
            useFilterStore.getState().setFilter({ searchText: 'wall' });
            expect(useFilterStore.getState().searchText).toBe('wall');
        });

        it('should reset filters', () => {
            useFilterStore.getState().setFilter({ discipline: 'MEP', searchText: 'duct' });
            useFilterStore.getState().resetFilters();
            expect(useFilterStore.getState().discipline).toBe('All');
            expect(useFilterStore.getState().searchText).toBe('');
        });
    });

    describe('useEditHistoryStore', () => {
        beforeEach(() => {
            useEditHistoryStore.getState().clear();
        });

        const makeAction = (value: string): EditAction => ({
            elementIDs: [1],
            psetName: 'Pset_WallCommon',
            propertyName: 'FireRating',
            oldValues: new Map([[1, '']]),
            newValue: value,
            timestamp: Date.now(),
        });

        it('should start with empty stacks', () => {
            const state = useEditHistoryStore.getState();
            expect(state.undoStack).toHaveLength(0);
            expect(state.redoStack).toHaveLength(0);
        });

        it('should push an edit onto the undo stack', () => {
            useEditHistoryStore.getState().pushEdit(makeAction('2HR'));
            expect(useEditHistoryStore.getState().undoStack).toHaveLength(1);
        });

        it('should clear redo stack on new edit', () => {
            useEditHistoryStore.getState().pushEdit(makeAction('2HR'));
            useEditHistoryStore.getState().undo();
            expect(useEditHistoryStore.getState().redoStack).toHaveLength(1);

            useEditHistoryStore.getState().pushEdit(makeAction('3HR'));
            expect(useEditHistoryStore.getState().redoStack).toHaveLength(0);
        });

        it('should undo', () => {
            useEditHistoryStore.getState().pushEdit(makeAction('2HR'));
            const action = useEditHistoryStore.getState().undo();
            expect(action).toBeDefined();
            expect(action?.newValue).toBe('2HR');
            expect(useEditHistoryStore.getState().undoStack).toHaveLength(0);
            expect(useEditHistoryStore.getState().redoStack).toHaveLength(1);
        });

        it('should redo', () => {
            useEditHistoryStore.getState().pushEdit(makeAction('2HR'));
            useEditHistoryStore.getState().undo();
            const action = useEditHistoryStore.getState().redo();
            expect(action).toBeDefined();
            expect(action?.newValue).toBe('2HR');
            expect(useEditHistoryStore.getState().undoStack).toHaveLength(1);
            expect(useEditHistoryStore.getState().redoStack).toHaveLength(0);
        });

        it('should return undefined when nothing to undo', () => {
            expect(useEditHistoryStore.getState().undo()).toBeUndefined();
        });

        it('should return undefined when nothing to redo', () => {
            expect(useEditHistoryStore.getState().redo()).toBeUndefined();
        });
    });

    describe('useUIStore', () => {
        it('should have leftBarOpen default true', () => {
            expect(useUIStore.getState().leftBarOpen).toBe(true);
        });

        it('should have rightBarOpen default true', () => {
            expect(useUIStore.getState().rightBarOpen).toBe(true);
        });

        it('should toggle upload dialog', () => {
            useUIStore.getState().setUploadDialogOpen(true);
            expect(useUIStore.getState().uploadDialogOpen).toBe(true);
        });

        it('should show snackbar', () => {
            useUIStore.getState().showSnackbar('Test message', 'success');
            const snack = useUIStore.getState().snackbar;
            expect(snack.open).toBe(true);
            expect(snack.message).toBe('Test message');
            expect(snack.severity).toBe('success');
        });

        it('should hide snackbar', () => {
            useUIStore.getState().showSnackbar('Hello');
            useUIStore.getState().hideSnackbar();
            expect(useUIStore.getState().snackbar.open).toBe(false);
        });

        it('should set left bar tab', () => {
            useUIStore.getState().setLeftBarTab(2);
            expect(useUIStore.getState().leftBarTab).toBe(2);
        });
    });

    describe('useVisibilityStore', () => {
        beforeEach(() => {
            useVisibilityStore.getState().unhideAll();
        });

        it('should start with nothing hidden', () => {
            const state = useVisibilityStore.getState();
            expect(state.hiddenIDs.size).toBe(0);
            expect(state.isolatedIDs).toBeNull();
        });

        it('should hide elements', () => {
            useVisibilityStore.getState().hideElements([1, 2, 3]);
            expect(useVisibilityStore.getState().hiddenIDs.size).toBe(3);
        });

        it('should unhide all', () => {
            useVisibilityStore.getState().hideElements([1, 2]);
            useVisibilityStore.getState().unhideAll();
            expect(useVisibilityStore.getState().hiddenIDs.size).toBe(0);
        });

        it('should isolate elements', () => {
            useVisibilityStore.getState().isolateElements([5, 10]);
            expect(useVisibilityStore.getState().isolatedIDs?.size).toBe(2);
            expect(useVisibilityStore.getState().isolatedIDs?.has(5)).toBe(true);
        });

        it('should report visibility correctly when hiding', () => {
            expect(useVisibilityStore.getState().isVisible(1)).toBe(true);
            useVisibilityStore.getState().hideElements([1]);
            expect(useVisibilityStore.getState().isVisible(1)).toBe(false);
            expect(useVisibilityStore.getState().isVisible(2)).toBe(true);
        });

        it('should report visibility correctly when isolating', () => {
            useVisibilityStore.getState().isolateElements([1]);
            expect(useVisibilityStore.getState().isVisible(1)).toBe(true);
            expect(useVisibilityStore.getState().isVisible(2)).toBe(false);
        });

        it('should clear isolation', () => {
            useVisibilityStore.getState().isolateElements([1]);
            useVisibilityStore.getState().clearIsolation();
            expect(useVisibilityStore.getState().isolatedIDs).toBeNull();
            expect(useVisibilityStore.getState().isVisible(2)).toBe(true);
        });
    });
});
