/**
 * IFC Export Service
 * Supports patch-first export (minimal changes) and rewrite fallback
 * Preserves IFC header comments in all export paths
 */
import { useModelStore } from '@/store';
import type { IfcElement, Property, PropertySet } from '@/types';

interface PatchEntry {
    expressID: number;
    propertyName: string;
    psetName: string;
    oldValue: string;
    newValue: string;
}

/**
 * Collect all modified properties across elements
 */
function collectModifiedProperties(): PatchEntry[] {
    const elements = useModelStore.getState().elements;
    const patches: PatchEntry[] = [];

    elements.forEach((element: IfcElement) => {
        element.psets.forEach((pset: PropertySet) => {
            if (!pset.isEditable) return;
            pset.properties.forEach((prop: Property) => {
                if (prop.modified && prop.value !== prop.originalValue) {
                    patches.push({
                        expressID: prop.expressID,
                        propertyName: prop.name,
                        psetName: pset.name,
                        oldValue: formatIfcValue(prop.originalValue),
                        newValue: formatIfcValue(prop.value),
                    });
                }
            });
        });
    });

    return patches;
}

export function formatIfcValue(value: string | number | boolean | null): string {
    if (value === null || value === undefined) return '$';
    if (typeof value === 'boolean') return value ? '.T.' : '.F.';
    if (typeof value === 'number') {
        if (Number.isInteger(value)) return String(value);
        return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '.0');
    }
    // String: wrap in single quotes, escape internal quotes
    return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Extract header section from IFC text, including comments
 */
function extractHeaderSection(text: string): string {
    const headerStart = text.indexOf('HEADER;');
    const headerEnd = text.indexOf('ENDSEC;', headerStart);
    if (headerStart === -1 || headerEnd === -1) return '';
    return text.substring(headerStart, headerEnd + 7);
}

/**
 * Try patch export: apply minimal text replacements to original STEP text
 */
function tryPatchExport(originalText: string, patches: PatchEntry[]): string | null {
    let result = originalText;

    for (const patch of patches) {
        // Find the STEP line for this property by expressID
        // Pattern: #<expressID>=IFCPROPERTYSINGLEVALUE(...);
        const idStr = `#${patch.expressID}`;
        const lineStart = result.indexOf(idStr + '=');
        if (lineStart === -1) {
            // If we can't find the line, we can't safely patch
            return null;
        }

        const lineEnd = result.indexOf(';', lineStart);
        if (lineEnd === -1) return null;

        const originalLine = result.substring(lineStart, lineEnd + 1);

        // Find the value within the STEP line
        // IFCPROPERTYSINGLEVALUE('Name',$,IFCLABEL('value'),$);
        // We need to replace the value part
        const oldValFormatted = patch.oldValue;
        const newValFormatted = patch.newValue;

        // Build a new line with the value replaced
        let newLine = originalLine;

        if (oldValFormatted === '$') {
            // Was null, now has value — need to replace the $ in the nominal value position
            // This is complex; fall back to rewrite
            return null;
        }

        // Simple value replacement within the line
        const oldIdx = newLine.indexOf(oldValFormatted);
        if (oldIdx === -1) {
            // Value not found literally in line — fall back
            return null;
        }

        newLine = newLine.substring(0, oldIdx) + newValFormatted + newLine.substring(oldIdx + oldValFormatted.length);
        result = result.substring(0, lineStart) + newLine + result.substring(lineEnd + 1);
    }

    return result;
}

/**
 * Rewrite export: rebuild modified STEP lines
 * Preserves header comments by extracting and reinserting them
 */
function rewriteExport(originalText: string, patches: PatchEntry[]): string {
    const headerSection = extractHeaderSection(originalText);
    let result = originalText;

    // Apply patches line by line
    for (const patch of patches) {
        const idStr = `#${patch.expressID}`;
        const lineStart = result.indexOf(idStr + '=');
        if (lineStart === -1) continue;

        const lineEnd = result.indexOf(';', lineStart);
        if (lineEnd === -1) continue;

        const originalLine = result.substring(lineStart, lineEnd + 1);

        // Parse the STEP line and rebuild with new value
        // For IFCPROPERTYSINGLEVALUE, the structure is:
        // IFCPROPERTYSINGLEVALUE('name', 'desc', IFCTYPE(value), unit);
        const newLine = rebuildPropertyLine(originalLine, patch.newValue);
        if (newLine) {
            result = result.substring(0, lineStart) + newLine + result.substring(lineEnd + 1);
        }
    }

    // Ensure header comments are preserved
    const newHeaderSection = extractHeaderSection(result);
    if (newHeaderSection !== headerSection) {
        result = result.replace(newHeaderSection, headerSection);
    }

    return result;
}

function rebuildPropertyLine(line: string, newValue: string): string | null {
    // Match: #ID=IFCPROPERTYSINGLEVALUE('name','description',IFCTYPE(value),unit);
    const regex = /^(#\d+=\s*IFCPROPERTYSINGLEVALUE\s*\([^,]+,[^,]*,\s*)([^,)]+(?:\([^)]*\))?)(\s*(?:,[^)]*)?;?\s*)$/i;
    const match = line.match(regex);

    if (!match) {
        // Try simpler approach: replace last non-$ value-like token before last comma/paren
        return null;
    }

    const prefix = match[1];
    const suffix = match[3];

    // Determine IFC type wrapper
    let wrappedValue = newValue;
    if (newValue === '$') {
        wrappedValue = '$';
    } else if (newValue === '.T.' || newValue === '.F.') {
        wrappedValue = `IFCBOOLEAN(${newValue})`;
    } else if (/^-?\d+(\.\d+)?$/.test(newValue)) {
        wrappedValue = `IFCREAL(${newValue})`;
    } else if (newValue.startsWith("'") && newValue.endsWith("'")) {
        wrappedValue = `IFCLABEL(${newValue})`;
    }

    return prefix + wrappedValue + suffix;
}

/**
 * Main export function
 */
export async function exportModifiedIfc(forceRewrite: boolean = false): Promise<Blob> {
    const { originalIfcText, modelInfo } = useModelStore.getState();

    if (!originalIfcText) {
        throw new Error('No original IFC text available for export');
    }

    const patches = collectModifiedProperties();

    if (patches.length === 0) {
        // No modifications, return original
        return new Blob([originalIfcText], { type: 'application/x-step' });
    }

    let result: string | null = null;

    if (!forceRewrite) {
        // Try patch first
        result = tryPatchExport(originalIfcText, patches);
    }

    if (!result) {
        // Fallback to rewrite
        console.warn('Patch export failed, falling back to rewrite export. Formatting may change.');
        result = rewriteExport(originalIfcText, patches);
    }

    return new Blob([result], { type: 'application/x-step' });
}

/**
 * Download the exported IFC file
 */
export async function downloadModifiedIfc(filename?: string, forceRewrite?: boolean): Promise<void> {
    const modelInfo = useModelStore.getState().modelInfo;
    const blob = await exportModifiedIfc(forceRewrite);
    const name = filename || modelInfo?.fileName?.replace('.ifc', '_modified.ifc') || 'modified.ifc';

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}

export function hasModifications(): boolean {
    const elements = useModelStore.getState().elements;
    let found = false;
    elements.forEach((el: IfcElement) => {
        if (found) return;
        el.psets.forEach((pset: PropertySet) => {
            if (found) return;
            pset.properties.forEach((prop: Property) => {
                if (prop.modified) found = true;
            });
        });
    });
    return found;
}
