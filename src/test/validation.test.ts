import { describe, it, expect } from 'vitest';
import { checkElement, getDefaultSeverity, getElementId } from '@/services/validationLogic';
import type { ValidateElement, ValidateRule } from '@/services/validationLogic';

function makeElement(overrides?: Partial<ValidateElement>): ValidateElement {
    return {
        expressID: 1,
        globalId: 'abc-123',
        name: 'Wall 001',
        tag: 'W001',
        ifcClass: 'IfcWall',
        level: 'Level 1',
        zone: '',
        discipline: 'Architecture',
        psets: [
            {
                name: 'Pset_WallCommon',
                properties: [
                    { name: 'FireRating', value: '2HR', type: 'IfcLabel' },
                    { name: 'IsExternal', value: true, type: 'IfcBoolean' },
                    { name: 'LoadBearing', value: true, type: 'IfcBoolean' },
                    { name: 'Reference', value: 'REF-001', type: 'IfcIdentifier' },
                ],
            },
        ],
        ...overrides,
    };
}

function makeRule(overrides?: Partial<ValidateRule>): ValidateRule {
    return {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'Test',
        applicability: { ifcClasses: ['IfcWall'] },
        requirements: [
            {
                psetName: 'Pset_WallCommon',
                propertyName: 'FireRating',
                checkType: 'notEmpty',
            },
        ],
        ...overrides,
    };
}

describe('Validation Logic', () => {
    describe('getElementId', () => {
        it('should prefer tag', () => {
            expect(getElementId(makeElement())).toBe('W001');
        });

        it('should fall back to name', () => {
            expect(getElementId(makeElement({ tag: '' }))).toBe('Wall 001');
        });

        it('should fall back to globalId', () => {
            expect(getElementId(makeElement({ tag: '', name: '' }))).toBe('abc-123');
        });
    });

    describe('getDefaultSeverity', () => {
        it('MissingValue → Warning', () => {
            expect(getDefaultSeverity('MissingValue')).toBe('Warning');
        });

        it('Naming → Error', () => {
            expect(getDefaultSeverity('Naming')).toBe('Error');
        });

        it('MissingParam → Error', () => {
            expect(getDefaultSeverity('MissingParam')).toBe('Error');
        });

        it('WrongValue → Error', () => {
            expect(getDefaultSeverity('WrongValue')).toBe('Error');
        });
    });

    describe('checkElement - applicability', () => {
        it('should skip elements that do not match ifcClasses', () => {
            const el = makeElement({ ifcClass: 'IfcDoor' });
            const rule = makeRule({ applicability: { ifcClasses: ['IfcWall'] } });
            expect(checkElement(el, rule)).toHaveLength(0);
        });

        it('should skip elements that do not match disciplines', () => {
            const el = makeElement({ discipline: 'MEP' });
            const rule = makeRule({ applicability: { disciplines: ['Architecture'] } });
            expect(checkElement(el, rule)).toHaveLength(0);
        });

        it('should apply rule when ifcClass matches', () => {
            const el = makeElement({ psets: [] }); // No psets → will generate issue
            const rule = makeRule();
            const issues = checkElement(el, rule);
            expect(issues.length).toBeGreaterThan(0);
        });
    });

    describe('checkElement - exists', () => {
        it('should pass when property exists', () => {
            const el = makeElement();
            const rule = makeRule({
                requirements: [{ psetName: 'Pset_WallCommon', propertyName: 'FireRating', checkType: 'exists' }],
            });
            expect(checkElement(el, rule)).toHaveLength(0);
        });

        it('should fail when pset is missing', () => {
            const el = makeElement({ psets: [] });
            const rule = makeRule({
                requirements: [{ psetName: 'Pset_WallCommon', propertyName: 'FireRating', checkType: 'exists' }],
            });
            const issues = checkElement(el, rule);
            expect(issues).toHaveLength(1);
            expect(issues[0].issueType).toBe('MissingParam');
        });

        it('should fail when property is missing from pset', () => {
            const el = makeElement({
                psets: [{ name: 'Pset_WallCommon', properties: [] }],
            });
            const rule = makeRule({
                requirements: [{ psetName: 'Pset_WallCommon', propertyName: 'FireRating', checkType: 'exists' }],
            });
            const issues = checkElement(el, rule);
            expect(issues).toHaveLength(1);
            expect(issues[0].issueType).toBe('MissingParam');
        });
    });

    describe('checkElement - notEmpty', () => {
        it('should pass when value is non-empty', () => {
            const el = makeElement();
            const rule = makeRule();
            expect(checkElement(el, rule)).toHaveLength(0);
        });

        it('should fail when value is empty string', () => {
            const el = makeElement({
                psets: [{
                    name: 'Pset_WallCommon',
                    properties: [{ name: 'FireRating', value: '', type: 'IfcLabel' }],
                }],
            });
            const rule = makeRule();
            const issues = checkElement(el, rule);
            expect(issues).toHaveLength(1);
            expect(issues[0].issueType).toBe('MissingValue');
            expect(issues[0].severity).toBe('Warning');
        });

        it('should fail when value is null', () => {
            const el = makeElement({
                psets: [{
                    name: 'Pset_WallCommon',
                    properties: [{ name: 'FireRating', value: null, type: 'IfcLabel' }],
                }],
            });
            const rule = makeRule();
            expect(checkElement(el, rule)).toHaveLength(1);
        });
    });

    describe('checkElement - equals', () => {
        it('should pass when value matches', () => {
            const el = makeElement();
            const rule = makeRule({
                requirements: [{
                    psetName: 'Pset_WallCommon',
                    propertyName: 'FireRating',
                    checkType: 'equals',
                    expected: '2HR',
                }],
            });
            expect(checkElement(el, rule)).toHaveLength(0);
        });

        it('should fail when value does not match', () => {
            const el = makeElement();
            const rule = makeRule({
                requirements: [{
                    psetName: 'Pset_WallCommon',
                    propertyName: 'FireRating',
                    checkType: 'equals',
                    expected: '1HR',
                }],
            });
            const issues = checkElement(el, rule);
            expect(issues).toHaveLength(1);
            expect(issues[0].issueType).toBe('WrongValue');
            expect(issues[0].expected).toBe('1HR');
            expect(issues[0].actual).toBe('2HR');
        });
    });

    describe('checkElement - inList', () => {
        it('should pass when value is in list', () => {
            const el = makeElement();
            const rule = makeRule({
                requirements: [{
                    psetName: 'Pset_WallCommon',
                    propertyName: 'FireRating',
                    checkType: 'inList',
                    expected: ['1HR', '2HR', '3HR'],
                }],
            });
            expect(checkElement(el, rule)).toHaveLength(0);
        });

        it('should fail when value is not in list', () => {
            const el = makeElement();
            const rule = makeRule({
                requirements: [{
                    psetName: 'Pset_WallCommon',
                    propertyName: 'FireRating',
                    checkType: 'inList',
                    expected: ['1HR', '3HR'],
                }],
            });
            const issues = checkElement(el, rule);
            expect(issues).toHaveLength(1);
            expect(issues[0].issueType).toBe('WrongValue');
        });
    });

    describe('checkElement - range', () => {
        it('should pass when number is in range', () => {
            const el = makeElement({
                psets: [{
                    name: 'Pset_WallCommon',
                    properties: [{ name: 'ThermalTransmittance', value: 0.5, type: 'IfcReal' }],
                }],
            });
            const rule = makeRule({
                requirements: [{
                    psetName: 'Pset_WallCommon',
                    propertyName: 'ThermalTransmittance',
                    checkType: 'range',
                    min: 0,
                    max: 1,
                }],
            });
            expect(checkElement(el, rule)).toHaveLength(0);
        });

        it('should fail when number is below min', () => {
            const el = makeElement({
                psets: [{
                    name: 'Pset_WallCommon',
                    properties: [{ name: 'ThermalTransmittance', value: -1, type: 'IfcReal' }],
                }],
            });
            const rule = makeRule({
                requirements: [{
                    psetName: 'Pset_WallCommon',
                    propertyName: 'ThermalTransmittance',
                    checkType: 'range',
                    min: 0,
                    max: 1,
                }],
            });
            expect(checkElement(el, rule)).toHaveLength(1);
        });

        it('should fail when number is above max', () => {
            const el = makeElement({
                psets: [{
                    name: 'Pset_WallCommon',
                    properties: [{ name: 'ThermalTransmittance', value: 5, type: 'IfcReal' }],
                }],
            });
            const rule = makeRule({
                requirements: [{
                    psetName: 'Pset_WallCommon',
                    propertyName: 'ThermalTransmittance',
                    checkType: 'range',
                    min: 0,
                    max: 1,
                }],
            });
            expect(checkElement(el, rule)).toHaveLength(1);
        });

        it('should fail when value is not a number', () => {
            const el = makeElement({
                psets: [{
                    name: 'Pset_WallCommon',
                    properties: [{ name: 'ThermalTransmittance', value: 'abc', type: 'IfcLabel' }],
                }],
            });
            const rule = makeRule({
                requirements: [{
                    psetName: 'Pset_WallCommon',
                    propertyName: 'ThermalTransmittance',
                    checkType: 'range',
                    min: 0,
                    max: 1,
                }],
            });
            expect(checkElement(el, rule)).toHaveLength(1);
        });
    });

    describe('checkElement - regex', () => {
        it('should pass when value matches pattern', () => {
            const el = makeElement({
                psets: [{
                    name: 'Pset_WallCommon',
                    properties: [{ name: 'Reference', value: 'ARC_WALL_001', type: 'IfcIdentifier' }],
                }],
            });
            const rule = makeRule({
                requirements: [{
                    psetName: 'Pset_WallCommon',
                    propertyName: 'Reference',
                    checkType: 'regex',
                    pattern: '^[A-Z]{3}_[A-Z]+_\\d+$',
                }],
            });
            expect(checkElement(el, rule)).toHaveLength(0);
        });

        it('should fail when value does not match pattern', () => {
            const el = makeElement({
                psets: [{
                    name: 'Pset_WallCommon',
                    properties: [{ name: 'Reference', value: 'bad name', type: 'IfcIdentifier' }],
                }],
            });
            const rule = makeRule({
                requirements: [{
                    psetName: 'Pset_WallCommon',
                    propertyName: 'Reference',
                    checkType: 'regex',
                    pattern: '^[A-Z]{3}_[A-Z]+_\\d+$',
                }],
            });
            const issues = checkElement(el, rule);
            expect(issues).toHaveLength(1);
            expect(issues[0].issueType).toBe('Naming');
        });
    });

    describe('checkElement - boolean', () => {
        it('should pass for boolean true', () => {
            const el = makeElement();
            const rule = makeRule({
                requirements: [{
                    psetName: 'Pset_WallCommon',
                    propertyName: 'IsExternal',
                    checkType: 'boolean',
                }],
            });
            expect(checkElement(el, rule)).toHaveLength(0);
        });

        it('should pass for .T. string', () => {
            const el = makeElement({
                psets: [{
                    name: 'Pset_WallCommon',
                    properties: [{ name: 'IsExternal', value: '.T.', type: 'IfcBoolean' }],
                }],
            });
            const rule = makeRule({
                requirements: [{
                    psetName: 'Pset_WallCommon',
                    propertyName: 'IsExternal',
                    checkType: 'boolean',
                }],
            });
            expect(checkElement(el, rule)).toHaveLength(0);
        });

        it('should fail for non-boolean value', () => {
            const el = makeElement({
                psets: [{
                    name: 'Pset_WallCommon',
                    properties: [{ name: 'IsExternal', value: 'maybe', type: 'IfcLabel' }],
                }],
            });
            const rule = makeRule({
                requirements: [{
                    psetName: 'Pset_WallCommon',
                    propertyName: 'IsExternal',
                    checkType: 'boolean',
                }],
            });
            const issues = checkElement(el, rule);
            expect(issues).toHaveLength(1);
            expect(issues[0].issueType).toBe('WrongValue');
        });
    });

    describe('checkElement - issue structure', () => {
        it('should populate all issue fields', () => {
            const el = makeElement({
                psets: [{
                    name: 'Pset_WallCommon',
                    properties: [{ name: 'FireRating', value: '', type: 'IfcLabel' }],
                }],
            });
            const rule = makeRule();
            const issues = checkElement(el, rule);
            expect(issues).toHaveLength(1);

            const issue = issues[0];
            expect(issue.expressID).toBe(1);
            expect(issue.globalId).toBe('abc-123');
            expect(issue.ifcClass).toBe('IfcWall');
            expect(issue.name).toBe('Wall 001');
            expect(issue.level).toBe('Level 1');
            expect(issue.ruleId).toBe('test-rule');
            expect(issue.ruleName).toBe('Test Rule');
            expect(issue.propertyPath).toBe('Pset_WallCommon.FireRating');
        });
    });

    describe('checkElement - multiple requirements', () => {
        it('should report issues for all failing requirements', () => {
            const el = makeElement({
                psets: [{
                    name: 'Pset_WallCommon',
                    properties: [
                        { name: 'FireRating', value: '', type: 'IfcLabel' },
                        { name: 'IsExternal', value: 'maybe', type: 'IfcLabel' },
                    ],
                }],
            });
            const rule = makeRule({
                requirements: [
                    { psetName: 'Pset_WallCommon', propertyName: 'FireRating', checkType: 'notEmpty' },
                    { psetName: 'Pset_WallCommon', propertyName: 'IsExternal', checkType: 'boolean' },
                ],
            });
            const issues = checkElement(el, rule);
            expect(issues).toHaveLength(2);
        });
    });
});
