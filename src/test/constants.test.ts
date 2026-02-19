import { describe, it, expect, beforeEach } from 'vitest';
import { getDiscipline, isPsetCommon, GRID_DEFAULTS, AXIS_COLORS, KNOWN_PSET_COMMON } from '@/constants';

describe('Constants', () => {
    describe('getDiscipline', () => {
        it('should return Architecture for IfcWall', () => {
            expect(getDiscipline('IfcWall')).toBe('Architecture');
        });

        it('should return Architecture for IfcDoor', () => {
            expect(getDiscipline('IfcDoor')).toBe('Architecture');
        });

        it('should return Architecture for IfcWindow', () => {
            expect(getDiscipline('IfcWindow')).toBe('Architecture');
        });

        it('should return Architecture for IfcSlab', () => {
            expect(getDiscipline('IfcSlab')).toBe('Architecture');
        });

        it('should return Structure for IfcBeam', () => {
            expect(getDiscipline('IfcBeam')).toBe('Structure');
        });

        it('should return Structure for IfcColumn', () => {
            expect(getDiscipline('IfcColumn')).toBe('Structure');
        });

        it('should return Structure for IfcFooting', () => {
            expect(getDiscipline('IfcFooting')).toBe('Structure');
        });

        it('should return MEP for IfcPipeSegment', () => {
            expect(getDiscipline('IfcPipeSegment')).toBe('MEP');
        });

        it('should return MEP for IfcDuctSegment', () => {
            expect(getDiscipline('IfcDuctSegment')).toBe('MEP');
        });

        it('should return MEP for IfcFlowTerminal', () => {
            expect(getDiscipline('IfcFlowTerminal')).toBe('MEP');
        });

        it('should return Unknown for unmapped types', () => {
            expect(getDiscipline('IfcUnknownType')).toBe('Unknown');
        });

        it('should return Unknown for empty string', () => {
            expect(getDiscipline('')).toBe('Unknown');
        });
    });

    describe('isPsetCommon', () => {
        it('should return true for Pset_WallCommon', () => {
            expect(isPsetCommon('Pset_WallCommon')).toBe(true);
        });

        it('should return true for Pset_DoorCommon', () => {
            expect(isPsetCommon('Pset_DoorCommon')).toBe(true);
        });

        it('should return true for Pset_BeamCommon', () => {
            expect(isPsetCommon('Pset_BeamCommon')).toBe(true);
        });

        it('should return false for Pset_WallCommonExtra', () => {
            // Must match exactly Pset_*Common
            expect(isPsetCommon('Pset_WallCommonExtra')).toBe(false);
        });

        it('should return false for regular psets', () => {
            expect(isPsetCommon('Pset_MaterialCommon')).toBe(true); // This is a valid pattern
            expect(isPsetCommon('CustomPset')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(isPsetCommon('')).toBe(false);
        });

        it('should return false for partial match', () => {
            expect(isPsetCommon('Pset_')).toBe(false);
        });
    });

    describe('Grid defaults', () => {
        it('should have 1m spacing', () => {
            expect(GRID_DEFAULTS.spacing).toBe(1);
        });

        it('should have 5 as major interval', () => {
            expect(GRID_DEFAULTS.majorInterval).toBe(5);
        });

        it('should have appropriate size', () => {
            expect(GRID_DEFAULTS.size).toBeGreaterThan(0);
        });
    });

    describe('Axis colors', () => {
        it('should have red for X', () => {
            expect(AXIS_COLORS.x).toBe(0xff0000);
        });

        it('should have green for Y', () => {
            expect(AXIS_COLORS.y).toBe(0x00ff00);
        });

        it('should have blue for Z', () => {
            expect(AXIS_COLORS.z).toBe(0x0000ff);
        });
    });

    describe('Known Pset_*Common families', () => {
        it('should include Pset_WallCommon', () => {
            expect(KNOWN_PSET_COMMON).toContain('Pset_WallCommon');
        });

        it('should include Pset_DoorCommon', () => {
            expect(KNOWN_PSET_COMMON).toContain('Pset_DoorCommon');
        });

        it('should include Pset_WindowCommon', () => {
            expect(KNOWN_PSET_COMMON).toContain('Pset_WindowCommon');
        });

        it('should include Pset_SlabCommon', () => {
            expect(KNOWN_PSET_COMMON).toContain('Pset_SlabCommon');
        });

        it('should include Pset_BeamCommon', () => {
            expect(KNOWN_PSET_COMMON).toContain('Pset_BeamCommon');
        });

        it('should include Pset_ColumnCommon', () => {
            expect(KNOWN_PSET_COMMON).toContain('Pset_ColumnCommon');
        });
    });
});
