import { describe, it, expect } from 'vitest';
import { IFCSG_RULE_PACK_V1 } from '@/services/defaultRulePack';

describe('Default Rule Pack (IFC+SG v1.0)', () => {
    it('should have a name', () => {
        expect(IFCSG_RULE_PACK_V1.name).toBe('IFC+SG Default');
    });

    it('should have a version', () => {
        expect(IFCSG_RULE_PACK_V1.version).toBe('1.0.0');
    });

    it('should have a description', () => {
        expect(IFCSG_RULE_PACK_V1.description).toBeTruthy();
    });

    it('should have rules', () => {
        expect(IFCSG_RULE_PACK_V1.rules.length).toBeGreaterThan(0);
    });

    it('should have unique rule IDs', () => {
        const ids = IFCSG_RULE_PACK_V1.rules.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('should have rules for IfcWall', () => {
        const wallRules = IFCSG_RULE_PACK_V1.rules.filter(
            (r) => r.applicability.ifcClasses?.includes('IfcWall')
        );
        expect(wallRules.length).toBeGreaterThan(0);
    });

    it('should check FireRating on walls', () => {
        const wallRules = IFCSG_RULE_PACK_V1.rules.filter(
            (r) => r.applicability.ifcClasses?.includes('IfcWall')
        );
        const fireRating = wallRules.some((r) =>
            r.requirements.some((req) => req.propertyName === 'FireRating')
        );
        expect(fireRating).toBe(true);
    });

    it('should check IsExternal on walls', () => {
        const wallRules = IFCSG_RULE_PACK_V1.rules.filter(
            (r) => r.applicability.ifcClasses?.includes('IfcWall')
        );
        const isExternal = wallRules.some((r) =>
            r.requirements.some((req) => req.propertyName === 'IsExternal')
        );
        expect(isExternal).toBe(true);
    });

    it('should have rules for IfcDoor', () => {
        const doorRules = IFCSG_RULE_PACK_V1.rules.filter(
            (r) => r.applicability.ifcClasses?.includes('IfcDoor')
        );
        expect(doorRules.length).toBeGreaterThan(0);
    });

    it('should have rules for IfcBeam', () => {
        const beamRules = IFCSG_RULE_PACK_V1.rules.filter(
            (r) => r.applicability.ifcClasses?.includes('IfcBeam')
        );
        expect(beamRules.length).toBeGreaterThan(0);
    });

    it('should have rules for IfcColumn', () => {
        const colRules = IFCSG_RULE_PACK_V1.rules.filter(
            (r) => r.applicability.ifcClasses?.includes('IfcColumn')
        );
        expect(colRules.length).toBeGreaterThan(0);
    });

    it('should have rules for IfcSpace', () => {
        const spaceRules = IFCSG_RULE_PACK_V1.rules.filter(
            (r) => r.applicability.ifcClasses?.includes('IfcSpace')
        );
        expect(spaceRules.length).toBeGreaterThan(0);
    });

    it('each rule should have at least one requirement', () => {
        for (const rule of IFCSG_RULE_PACK_V1.rules) {
            expect(rule.requirements.length).toBeGreaterThan(0);
        }
    });

    it('each requirement should have a valid checkType', () => {
        const validTypes = ['exists', 'notEmpty', 'equals', 'inList', 'range', 'regex', 'boolean'];
        for (const rule of IFCSG_RULE_PACK_V1.rules) {
            for (const req of rule.requirements) {
                expect(validTypes).toContain(req.checkType);
            }
        }
    });

    it('each rule should have a psetName in requirements', () => {
        for (const rule of IFCSG_RULE_PACK_V1.rules) {
            for (const req of rule.requirements) {
                expect(req.psetName).toBeTruthy();
            }
        }
    });
});
