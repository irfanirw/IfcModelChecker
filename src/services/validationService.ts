/**
 * Validation Service — orchestrates validation worker
 */
import { useModelStore, useValidationStore, useUIStore } from '@/store';
import { getDiscipline } from '@/constants';
import type { IfcElement, RulePack, ValidationResult } from '@/types';
import type { ValidateElement, ValidateRule } from '@/workers/validation.worker';

export class ValidationService {
    private worker: Worker | null = null;

    async validate(rulePack: RulePack): Promise<ValidationResult> {
        const modelStore = useModelStore.getState();
        const validationStore = useValidationStore.getState();
        const uiStore = useUIStore.getState();

        if (modelStore.elements.size === 0) {
            throw new Error('No model loaded');
        }

        validationStore.setValidating(true);
        validationStore.setValidationProgress(0);

        return new Promise<ValidationResult>((resolve, reject) => {
            this.worker = new Worker(
                new URL('../workers/validation.worker.ts', import.meta.url),
                { type: 'module' }
            );

            // Convert elements to serializable format
            const elements: ValidateElement[] = [];
            modelStore.elements.forEach((el: IfcElement) => {
                elements.push({
                    expressID: el.expressID,
                    globalId: el.globalId,
                    name: el.name,
                    tag: el.tag,
                    ifcClass: el.ifcClass,
                    level: el.level,
                    zone: el.zone,
                    discipline: el.discipline,
                    psets: el.psets.map((ps) => ({
                        name: ps.name,
                        properties: ps.properties.map((p) => ({
                            name: p.name,
                            value: p.value,
                            type: p.type,
                        })),
                    })),
                });
            });

            const rules: ValidateRule[] = rulePack.rules.map((r) => ({
                id: r.id,
                name: r.name,
                description: r.description,
                applicability: {
                    ifcClasses: r.applicability.ifcClasses,
                    disciplines: r.applicability.disciplines,
                    psetNames: r.applicability.psetNames,
                },
                requirements: r.requirements.map((req) => ({
                    psetName: req.psetName,
                    propertyName: req.propertyName,
                    checkType: req.checkType,
                    expected: req.expected,
                    min: req.min,
                    max: req.max,
                    pattern: req.pattern,
                    severity: req.severity,
                })),
            }));

            this.worker.onmessage = (event) => {
                const msg = event.data;

                switch (msg.type) {
                    case 'progress':
                        validationStore.setValidationProgress(msg.percent);
                        break;

                    case 'result': {
                        const result: ValidationResult = {
                            modelName: modelStore.modelInfo?.fileName || 'Unknown',
                            timestamp: msg.timestamp,
                            schema: modelStore.modelInfo?.schema || 'Unknown',
                            rulePackName: rulePack.name,
                            rulePackVersion: rulePack.version,
                            totalElements: msg.totalElements,
                            totalIssues: msg.totalIssues,
                            errors: msg.errors,
                            warnings: msg.warnings,
                            passed: msg.passed,
                            issues: msg.issues,
                        };

                        validationStore.setValidationResult(result);
                        validationStore.setValidating(false);
                        validationStore.setValidationProgress(100);
                        uiStore.showSnackbar(
                            `Validation complete: ${msg.totalIssues} issues (${msg.errors} errors, ${msg.warnings} warnings)`,
                            msg.errors > 0 ? 'warning' : 'success'
                        );
                        resolve(result);
                        break;
                    }

                    case 'error':
                        validationStore.setValidating(false);
                        uiStore.showSnackbar(`Validation error: ${msg.message}`, 'error');
                        reject(new Error(msg.message));
                        break;
                }
            };

            this.worker.onerror = (err) => {
                validationStore.setValidating(false);
                reject(err);
            };

            this.worker.postMessage({
                type: 'validate',
                elements,
                rules,
                rulePackName: rulePack.name,
                rulePackVersion: rulePack.version,
                modelName: modelStore.modelInfo?.fileName || '',
                schema: modelStore.modelInfo?.schema || '',
            });
        });
    }

    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

export const validationService = new ValidationService();
