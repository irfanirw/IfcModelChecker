/**
 * IDS XML Parser
 * Parses IDS (Information Delivery Specification) XML into internal rule format
 */
import type { IDSSpecification, IDSFacet, IDSRequirement, ValidationRule, RuleRequirement, RulePack } from '@/types';

export function parseIdsXml(xmlText: string): IDSSpecification[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');

    const parserErrors = doc.getElementsByTagName('parsererror');
    if (parserErrors.length > 0) {
        throw new Error('Invalid IDS XML: ' + parserErrors[0].textContent);
    }

    const specifications: IDSSpecification[] = [];
    const specElements = doc.getElementsByTagName('specification');

    for (let i = 0; i < specElements.length; i++) {
        const specEl = specElements[i];
        const spec = parseSpecification(specEl);
        if (spec) specifications.push(spec);
    }

    return specifications;
}

function parseSpecification(specEl: Element): IDSSpecification | null {
    const name = specEl.getAttribute('name') || `Specification ${specEl.getAttribute('ifcVersion') || ''}`;
    const description = specEl.getAttribute('description') || undefined;
    const ifcVersion = specEl.getAttribute('ifcVersion') || undefined;

    // Parse applicability
    const applicabilityEl = specEl.getElementsByTagName('applicability')[0];
    const applicability: IDSFacet[] = [];
    if (applicabilityEl) {
        applicability.push(...parseFacets(applicabilityEl));
    }

    // Parse requirements
    const requirementsEl = specEl.getElementsByTagName('requirements')[0];
    const requirements: IDSRequirement[] = [];
    if (requirementsEl) {
        for (const facet of parseFacets(requirementsEl)) {
            const cardinality = (requirementsEl.getAttribute('cardinality') || 'required') as 'required' | 'optional' | 'prohibited';
            requirements.push({ facet, cardinality });
        }
    }

    if (applicability.length === 0 && requirements.length === 0) return null;

    return { name, description, ifcVersion, applicability, requirements };
}

function parseFacets(parentEl: Element): IDSFacet[] {
    const facets: IDSFacet[] = [];
    const children = parentEl.children;

    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const tagName = child.tagName.toLowerCase();

        switch (tagName) {
            case 'entity': {
                const nameEl = child.getElementsByTagName('name')[0];
                const entityName = getSimpleValue(nameEl);
                if (entityName) {
                    facets.push({ type: 'entity', entityName });
                }
                break;
            }
            case 'attribute': {
                const nameEl = child.getElementsByTagName('name')[0];
                const valueEl = child.getElementsByTagName('value')[0];
                facets.push({
                    type: 'attribute',
                    attributeName: getSimpleValue(nameEl) || '',
                    value: getSimpleValue(valueEl) || undefined,
                    pattern: getRestrictionPattern(valueEl),
                });
                break;
            }
            case 'property': {
                const psetEl = child.getElementsByTagName('propertyset')[0] || child.getElementsByTagName('propertySet')[0];
                const nameEl = child.getElementsByTagName('name')[0] || child.getElementsByTagName('baseName')[0];
                const valueEl = child.getElementsByTagName('value')[0];
                facets.push({
                    type: 'property',
                    psetName: getSimpleValue(psetEl) || '',
                    propertyName: getSimpleValue(nameEl) || '',
                    value: getSimpleValue(valueEl) || undefined,
                    pattern: getRestrictionPattern(valueEl),
                });
                break;
            }
            case 'classification': {
                facets.push({ type: 'classification' });
                break;
            }
            case 'material': {
                facets.push({ type: 'material' });
                break;
            }
            case 'partof': {
                facets.push({ type: 'partOf' });
                break;
            }
        }
    }

    return facets;
}

function getSimpleValue(el: Element | undefined): string | undefined {
    if (!el) return undefined;
    // Check for simpleValue
    const simpleValue = el.getElementsByTagName('simpleValue')[0];
    if (simpleValue) return simpleValue.textContent || undefined;

    // Check for xs:restriction / xs:enumeration
    const restriction = el.getElementsByTagName('xs:restriction')[0] || el.getElementsByTagName('restriction')[0];
    if (restriction) {
        const enums = restriction.getElementsByTagName('xs:enumeration') || restriction.getElementsByTagName('enumeration');
        if (enums.length > 0) {
            return enums[0].getAttribute('value') || undefined;
        }
    }

    return el.textContent?.trim() || undefined;
}

function getRestrictionPattern(el: Element | undefined): string | undefined {
    if (!el) return undefined;
    const restriction = el.getElementsByTagName('xs:restriction')[0] || el.getElementsByTagName('restriction')[0];
    if (!restriction) return undefined;

    const pattern = restriction.getElementsByTagName('xs:pattern')[0] || restriction.getElementsByTagName('pattern')[0];
    if (pattern) return pattern.getAttribute('value') || undefined;

    return undefined;
}

/**
 * Convert IDS specifications to internal ValidationRules
 */
export function idsToRulePack(specs: IDSSpecification[], fileName: string): RulePack {
    const rules: ValidationRule[] = [];
    const unsupportedFacets: string[] = [];

    for (const spec of specs) {
        const ifcClasses: string[] = [];

        // Extract applicable IFC classes
        for (const facet of spec.applicability) {
            if (facet.type === 'entity' && facet.entityName) {
                ifcClasses.push(facet.entityName);
            }
            if (facet.type === 'classification' || facet.type === 'material' || facet.type === 'partOf') {
                unsupportedFacets.push(`${facet.type} facet in "${spec.name}"`);
            }
        }

        const requirements: RuleRequirement[] = [];

        for (const req of spec.requirements) {
            if (req.facet.type === 'property') {
                const r: RuleRequirement = {
                    psetName: req.facet.psetName || '',
                    propertyName: req.facet.propertyName || '',
                    checkType: 'exists',
                };

                if (req.cardinality === 'required') {
                    if (req.facet.value) {
                        r.checkType = 'equals';
                        r.expected = req.facet.value;
                    } else if (req.facet.pattern) {
                        r.checkType = 'regex';
                        r.pattern = req.facet.pattern;
                    } else {
                        r.checkType = 'notEmpty';
                    }
                } else if (req.cardinality === 'prohibited') {
                    // We'd mark presence as an error; simplify to 'exists' check inverted
                    r.checkType = 'exists';
                }

                requirements.push(r);
            } else if (req.facet.type === 'attribute') {
                // Attribute checks — map to a pseudo-pset
                if (req.facet.attributeName) {
                    const r: RuleRequirement = {
                        psetName: '__attributes__',
                        propertyName: req.facet.attributeName,
                        checkType: req.facet.pattern ? 'regex' : req.facet.value ? 'equals' : 'notEmpty',
                        expected: req.facet.value,
                        pattern: req.facet.pattern,
                    };
                    requirements.push(r);
                }
            } else {
                unsupportedFacets.push(`${req.facet.type} requirement in "${spec.name}"`);
            }
        }

        if (requirements.length > 0) {
            rules.push({
                id: `ids-${spec.name.replace(/\s+/g, '-').toLowerCase()}-${rules.length}`,
                name: spec.name,
                description: spec.description || '',
                applicability: {
                    ifcClasses: ifcClasses.length > 0 ? ifcClasses : undefined,
                },
                requirements,
            });
        }
    }

    if (unsupportedFacets.length > 0) {
        console.warn('Unsupported IDS facets:', unsupportedFacets);
    }

    return {
        name: `IDS: ${fileName}`,
        version: '1.0',
        description: `Imported from ${fileName}. ${unsupportedFacets.length} unsupported facets skipped.`,
        rules,
    };
}
