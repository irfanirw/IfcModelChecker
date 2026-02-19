import { describe, it, expect, beforeEach } from 'vitest';
import { formatIfcValue, hasModifications } from '@/services/ifcExport';
import { useModelStore } from '@/store';
import type { IfcElement, Property } from '@/types';

function makeElement(id: number, name: string, props: Property[]): IfcElement {
    return {
        expressID: id,
        globalId: `guid-${id}`,
        ifcClass: 'IfcWall',
        ifcType: 2391406946,
        name,
        tag: `tag-${id}`,
        level: 'Level 1',
        zone: '',
        discipline: 'Architecture',
        psets: [
            {
                name: 'Pset_WallCommon',
                expressID: 100 + id,
                isEditable: true,
                properties: props,
            },
        ],
        modelID: 0,
    };
}

function makeProp(name: string, value: any, originalValue: any, modified: boolean): Property {
    return {
        name,
        value,
        originalValue,
        type: 'IfcLabel',
        expressID: Math.floor(Math.random() * 10000),
        modified,
    };
}

describe('IFC Export Service', () => {
    describe('formatIfcValue', () => {
        it('should format null as $', () => {
            expect(formatIfcValue(null)).toBe('$');
        });

        it('should format boolean true as .T.', () => {
            expect(formatIfcValue(true)).toBe('.T.');
        });

        it('should format boolean false as .F.', () => {
            expect(formatIfcValue(false)).toBe('.F.');
        });

        it('should format integers without decimals', () => {
            expect(formatIfcValue(42)).toBe('42');
        });

        it('should format floats with precision', () => {
            const result = formatIfcValue(3.14);
            expect(result).toContain('3.14');
        });

        it('should format strings with single quotes', () => {
            expect(formatIfcValue('Hello')).toBe("'Hello'");
            expect(formatIfcValue('2HR')).toBe("'2HR'");
        });

        it('should escape internal single quotes', () => {
            expect(formatIfcValue("it's")).toBe("'it''s'");
        });
    });

    describe('hasModifications', () => {
        beforeEach(() => {
            useModelStore.getState().reset();
        });

        it('should return false for elements with no changes', () => {
            const elements = new Map<number, IfcElement>();
            elements.set(1, makeElement(1, 'Wall', [
                makeProp('FireRating', '2HR', '2HR', false),
            ]));
            useModelStore.getState().setElements(elements);
            expect(hasModifications()).toBe(false);
        });

        it('should return true for elements with changes', () => {
            const elements = new Map<number, IfcElement>();
            elements.set(1, makeElement(1, 'Wall', [
                makeProp('FireRating', '2HR', '', true),
            ]));
            useModelStore.getState().setElements(elements);
            expect(hasModifications()).toBe(true);
        });

        it('should return false for empty element map', () => {
            expect(hasModifications()).toBe(false);
        });
    });
});