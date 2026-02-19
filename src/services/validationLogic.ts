/**
 * Core validation logic — extracted for testability
 * Used by validation.worker.ts
 */
import type {
    ValidationIssue,
    IssueSeverity,
    IssueType,
} from '@/types';

export interface ValidateElement {
    expressID: number;
    globalId: string;
    name: string;
    tag: string;
    ifcClass: string;
    level: string;
    zone: string;
    discipline: string;
    psets: {
        name: string;
        properties: {
            name: string;
            value: string | number | boolean | null;
            type: string;
        }[];
    }[];
}

export interface ValidateRule {
    id: string;
    name: string;
    description: string;
    applicability: {
        ifcClasses?: string[];
        disciplines?: string[];
        psetNames?: string[];
    };
    requirements: {
        psetName: string;
        propertyName: string;
        checkType: 'exists' | 'notEmpty' | 'equals' | 'inList' | 'range' | 'regex' | 'boolean';
        expected?: any;
        min?: number;
        max?: number;
        pattern?: string;
        severity?: IssueSeverity;
    }[];
}

export function getElementId(el: ValidateElement): string {
    return el.tag || el.name || el.globalId;
}

export function getDefaultSeverity(issueType: IssueType): IssueSeverity {
    switch (issueType) {
        case 'MissingValue':
            return 'Warning';
        case 'Naming':
            return 'Error';
        case 'MissingParam':
        case 'WrongValue':
        default:
            return 'Error';
    }
}

export function checkElement(
    element: ValidateElement,
    rule: ValidateRule
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check applicability
    const { applicability } = rule;
    if (applicability.ifcClasses && applicability.ifcClasses.length > 0) {
        if (!applicability.ifcClasses.includes(element.ifcClass)) return issues;
    }
    if (applicability.disciplines && applicability.disciplines.length > 0) {
        if (!applicability.disciplines.includes(element.discipline)) return issues;
    }

    for (const req of rule.requirements) {
        const pset = element.psets.find((p) => p.name === req.psetName);
        const propertyPath = `${req.psetName}.${req.propertyName}`;

        if (!pset) {
            if (req.checkType === 'exists' || req.checkType === 'notEmpty') {
                const issueType: IssueType = 'MissingParam';
                issues.push({
                    id: `${element.expressID}-${rule.id}-${req.propertyName}`,
                    discipline: element.discipline as any,
                    elementId: getElementId(element),
                    globalId: element.globalId,
                    expressID: element.expressID,
                    ifcClass: element.ifcClass,
                    name: element.name,
                    level: element.level,
                    zone: element.zone,
                    ruleId: rule.id,
                    ruleName: rule.name,
                    issueType,
                    propertyPath,
                    expected: 'Property should exist',
                    actual: 'Property set not found',
                    severity: req.severity || getDefaultSeverity(issueType),
                });
            }
            continue;
        }

        const prop = pset.properties.find((p) => p.name === req.propertyName);

        if (!prop) {
            const issueType: IssueType = 'MissingParam';
            issues.push({
                id: `${element.expressID}-${rule.id}-${req.propertyName}`,
                discipline: element.discipline as any,
                elementId: getElementId(element),
                globalId: element.globalId,
                expressID: element.expressID,
                ifcClass: element.ifcClass,
                name: element.name,
                level: element.level,
                zone: element.zone,
                ruleId: rule.id,
                ruleName: rule.name,
                issueType,
                propertyPath,
                expected: 'Property should exist',
                actual: 'Property not found',
                severity: req.severity || getDefaultSeverity(issueType),
            });
            continue;
        }

        const value = prop.value;

        switch (req.checkType) {
            case 'exists':
                break;

            case 'notEmpty':
                if (value === null || value === undefined || value === '') {
                    const issueType: IssueType = 'MissingValue';
                    issues.push({
                        id: `${element.expressID}-${rule.id}-${req.propertyName}`,
                        discipline: element.discipline as any,
                        elementId: getElementId(element),
                        globalId: element.globalId,
                        expressID: element.expressID,
                        ifcClass: element.ifcClass,
                        name: element.name,
                        level: element.level,
                        zone: element.zone,
                        ruleId: rule.id,
                        ruleName: rule.name,
                        issueType,
                        propertyPath,
                        expected: 'Value should not be empty',
                        actual: String(value ?? '(empty)'),
                        severity: req.severity || getDefaultSeverity(issueType),
                    });
                }
                break;

            case 'equals':
                if (value !== req.expected) {
                    const issueType: IssueType = 'WrongValue';
                    issues.push({
                        id: `${element.expressID}-${rule.id}-${req.propertyName}`,
                        discipline: element.discipline as any,
                        elementId: getElementId(element),
                        globalId: element.globalId,
                        expressID: element.expressID,
                        ifcClass: element.ifcClass,
                        name: element.name,
                        level: element.level,
                        zone: element.zone,
                        ruleId: rule.id,
                        ruleName: rule.name,
                        issueType,
                        propertyPath,
                        expected: String(req.expected),
                        actual: String(value ?? '(empty)'),
                        severity: req.severity || getDefaultSeverity(issueType),
                    });
                }
                break;

            case 'inList': {
                const list = Array.isArray(req.expected) ? req.expected : [req.expected];
                if (!list.includes(value)) {
                    const issueType: IssueType = 'WrongValue';
                    issues.push({
                        id: `${element.expressID}-${rule.id}-${req.propertyName}`,
                        discipline: element.discipline as any,
                        elementId: getElementId(element),
                        globalId: element.globalId,
                        expressID: element.expressID,
                        ifcClass: element.ifcClass,
                        name: element.name,
                        level: element.level,
                        zone: element.zone,
                        ruleId: rule.id,
                        ruleName: rule.name,
                        issueType,
                        propertyPath,
                        expected: `One of: ${list.join(', ')}`,
                        actual: String(value ?? '(empty)'),
                        severity: req.severity || getDefaultSeverity(issueType),
                    });
                }
                break;
            }

            case 'range': {
                const num = Number(value);
                if (isNaN(num) || (req.min !== undefined && num < req.min) || (req.max !== undefined && num > req.max)) {
                    const issueType: IssueType = 'WrongValue';
                    const expectedStr = `${req.min ?? '-∞'} ≤ value ≤ ${req.max ?? '∞'}`;
                    issues.push({
                        id: `${element.expressID}-${rule.id}-${req.propertyName}`,
                        discipline: element.discipline as any,
                        elementId: getElementId(element),
                        globalId: element.globalId,
                        expressID: element.expressID,
                        ifcClass: element.ifcClass,
                        name: element.name,
                        level: element.level,
                        zone: element.zone,
                        ruleId: rule.id,
                        ruleName: rule.name,
                        issueType,
                        propertyPath,
                        expected: expectedStr,
                        actual: String(value ?? '(empty)'),
                        severity: req.severity || getDefaultSeverity(issueType),
                    });
                }
                break;
            }

            case 'regex': {
                const pattern = req.pattern;
                if (pattern) {
                    try {
                        const re = new RegExp(pattern);
                        if (!re.test(String(value ?? ''))) {
                            const issueType: IssueType = 'Naming';
                            issues.push({
                                id: `${element.expressID}-${rule.id}-${req.propertyName}`,
                                discipline: element.discipline as any,
                                elementId: getElementId(element),
                                globalId: element.globalId,
                                expressID: element.expressID,
                                ifcClass: element.ifcClass,
                                name: element.name,
                                level: element.level,
                                zone: element.zone,
                                ruleId: rule.id,
                                ruleName: rule.name,
                                issueType,
                                propertyPath,
                                expected: `Matches: ${pattern}`,
                                actual: String(value ?? '(empty)'),
                                severity: req.severity || getDefaultSeverity(issueType),
                                suggestedFix: 'Check naming convention',
                            });
                        }
                    } catch {
                        // Invalid regex, skip
                    }
                }
                break;
            }

            case 'boolean':
                if (typeof value !== 'boolean' && value !== 'true' && value !== 'false' && value !== '.T.' && value !== '.F.') {
                    const issueType: IssueType = 'WrongValue';
                    issues.push({
                        id: `${element.expressID}-${rule.id}-${req.propertyName}`,
                        discipline: element.discipline as any,
                        elementId: getElementId(element),
                        globalId: element.globalId,
                        expressID: element.expressID,
                        ifcClass: element.ifcClass,
                        name: element.name,
                        level: element.level,
                        zone: element.zone,
                        ruleId: rule.id,
                        ruleName: rule.name,
                        issueType,
                        propertyPath,
                        expected: 'Boolean value (true/false)',
                        actual: String(value ?? '(empty)'),
                        severity: req.severity || getDefaultSeverity(issueType),
                    });
                }
                break;
        }
    }

    return issues;
}
