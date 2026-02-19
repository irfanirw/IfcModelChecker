/**
 * Validation Worker
 * Runs rule checks in a Web Worker to avoid blocking the UI
 */
import type {
    ValidationIssue,
    IssueSeverity,
    IssueType,
} from '@/types';

export interface ValidateRequest {
    type: 'validate';
    elements: ValidateElement[];
    rules: ValidateRule[];
    rulePackName: string;
    rulePackVersion: string;
    modelName: string;
    schema: string;
}

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

export interface ValidateProgress {
    type: 'progress';
    percent: number;
    message: string;
}

export interface ValidateResult {
    type: 'result';
    issues: ValidationIssue[];
    totalElements: number;
    totalIssues: number;
    errors: number;
    warnings: number;
    passed: number;
    timestamp: string;
}

export interface ValidateError {
    type: 'error';
    message: string;
}

export type ValidationWorkerMessage = ValidateRequest;
export type ValidationWorkerResponse = ValidateProgress | ValidateResult | ValidateError;

function getElementId(el: ValidateElement): string {
    return el.tag || el.name || el.globalId;
}

function getDefaultSeverity(issueType: IssueType): IssueSeverity {
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

function checkElement(
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
            // Pset doesn't exist → check if we need the property
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
            // Property doesn't exist
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
                // Already found, pass
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

function runValidation(request: ValidateRequest): ValidateResult {
    const { elements, rules, modelName, schema, rulePackName, rulePackVersion } = request;
    const allIssues: ValidationIssue[] = [];
    const total = elements.length;
    let processedCount = 0;
    const elementIssueMap = new Set<number>();

    for (const element of elements) {
        for (const rule of rules) {
            const issues = checkElement(element, rule);
            if (issues.length > 0) {
                allIssues.push(...issues);
                elementIssueMap.add(element.expressID);
            }
        }
        processedCount++;
        if (processedCount % 100 === 0) {
            self.postMessage({
                type: 'progress',
                percent: Math.round((processedCount / total) * 90),
                message: `Validating... ${processedCount}/${total} elements`,
            } as ValidateProgress);
        }
    }

    const errors = allIssues.filter((i) => i.severity === 'Error').length;
    const warnings = allIssues.filter((i) => i.severity === 'Warning').length;
    const passed = total - elementIssueMap.size;

    return {
        type: 'result',
        issues: allIssues,
        totalElements: total,
        totalIssues: allIssues.length,
        errors,
        warnings,
        passed,
        timestamp: new Date().toISOString(),
    };
}

self.onmessage = (event: MessageEvent<ValidationWorkerMessage>) => {
    const msg = event.data;

    if (msg.type === 'validate') {
        try {
            self.postMessage({
                type: 'progress',
                percent: 5,
                message: 'Starting validation...',
            } as ValidateProgress);

            const result = runValidation(msg);
            self.postMessage(result);
        } catch (err: any) {
            self.postMessage({
                type: 'error',
                message: err.message || 'Validation failed',
            } as ValidateError);
        }
    }
};
