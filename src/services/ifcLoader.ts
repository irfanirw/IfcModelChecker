/**
 * IFC Loader Service — orchestrates the Web Worker for IFC parsing
 */
import { useModelStore, useSelectionStore, useUIStore, useVisibilityStore, useEditHistoryStore, useValidationStore } from '@/store';
import { getDiscipline, isPsetCommon } from '@/constants';
import type { IfcElement, PropertySet, Property, SpatialNode, TypeGroup } from '@/types';

export class IfcLoaderService {
    private worker: Worker | null = null;

    async loadFile(file: File): Promise<void> {
        const store = useModelStore.getState();
        const uiStore = useUIStore.getState();

        // Reset all stores
        store.reset();
        useSelectionStore.getState().clearSelection();
        useVisibilityStore.getState().unhideAll();
        useEditHistoryStore.getState().clear();
        useValidationStore.getState().setValidationResult(null);

        store.setLoading(true);
        store.setLoadProgress(0);
        store.setLoadError(null);

        try {
            const buffer = await file.arrayBuffer();

            // Store original text for patch export
            const decoder = new TextDecoder('utf-8');
            const originalText = decoder.decode(buffer.slice(0));
            store.setOriginalIfcText(originalText);

            return new Promise<void>((resolve, reject) => {
                this.worker = new Worker(
                    new URL('../workers/ifcParser.worker.ts', import.meta.url),
                    { type: 'module' }
                );

                this.worker.onmessage = (event) => {
                    const msg = event.data;

                    switch (msg.type) {
                        case 'progress':
                            store.setLoadProgress(msg.percent);
                            break;

                        case 'result': {
                            try {
                                const elements = new Map<number, IfcElement>();
                                const classSet = new Set<string>();
                                const levelSet = new Set<string>();
                                const zoneSet = new Set<string>();

                                for (const parsed of msg.elements) {
                                    const discipline = getDiscipline(parsed.ifcClass);
                                    const psets: PropertySet[] = parsed.psets.map((ps: any) => ({
                                        name: ps.name,
                                        expressID: ps.expressID,
                                        isEditable: isPsetCommon(ps.name),
                                        properties: ps.properties.map((p: any): Property => ({
                                            name: p.name,
                                            expressID: p.expressID,
                                            value: p.value,
                                            type: p.type,
                                            originalValue: p.value,
                                            modified: false,
                                        })),
                                    }));

                                    const element: IfcElement = {
                                        expressID: parsed.expressID,
                                        globalId: parsed.globalId,
                                        name: parsed.name,
                                        tag: parsed.tag,
                                        ifcClass: parsed.ifcClass,
                                        ifcType: parsed.ifcType,
                                        level: parsed.level,
                                        zone: parsed.zone,
                                        discipline,
                                        psets,
                                        modelID: 0,
                                    };

                                    elements.set(parsed.expressID, element);
                                    classSet.add(parsed.ifcClass);
                                    if (parsed.level) levelSet.add(parsed.level);
                                    if (parsed.zone) zoneSet.add(parsed.zone);
                                }

                                store.setElements(elements);
                                store.setIfcClasses(Array.from(classSet).sort());
                                store.setLevels(Array.from(levelSet).sort());
                                store.setZones(Array.from(zoneSet).sort());

                                // Build type groups
                                const typeMap = new Map<string, number[]>();
                                elements.forEach((el) => {
                                    const ids = typeMap.get(el.ifcClass) || [];
                                    ids.push(el.expressID);
                                    typeMap.set(el.ifcClass, ids);
                                });
                                const typeGroups: TypeGroup[] = Array.from(typeMap.entries())
                                    .map(([ifcClass, expressIDs]) => ({
                                        ifcClass,
                                        count: expressIDs.length,
                                        expressIDs,
                                    }))
                                    .sort((a, b) => a.ifcClass.localeCompare(b.ifcClass));
                                store.setTypeGroups(typeGroups);

                                // Spatial tree
                                if (msg.spatialTree) {
                                    store.setSpatialTree(msg.spatialTree as SpatialNode);
                                }

                                // Geometry data — store so Viewport can feed it to SceneManager
                                if (msg.geometries && msg.geometries.length > 0) {
                                    store.setGeometries(msg.geometries);
                                }

                                // Model info
                                store.setModelInfo({
                                    fileName: file.name,
                                    fileSize: file.size,
                                    schema: msg.schema,
                                    description: msg.description,
                                    headerComments: msg.headerComments,
                                });

                                store.setLoading(false);
                                store.setLoadProgress(100);
                                uiStore.showSnackbar(`Model loaded: ${elements.size} elements`, 'success');

                                resolve();
                            } catch (resultErr: any) {
                                console.error('[ifcLoader] Error processing result:', resultErr);
                                store.setLoadError(resultErr.message || 'Error processing model data');
                                store.setLoading(false);
                                uiStore.showSnackbar(`Error: ${resultErr.message}`, 'error');
                                reject(resultErr);
                            }
                            break;
                        }

                        case 'error':
                            store.setLoadError(msg.message);
                            store.setLoading(false);
                            uiStore.showSnackbar(`Error: ${msg.message}`, 'error');
                            reject(new Error(msg.message));
                            break;
                    }
                };

                this.worker.onerror = (err) => {
                    store.setLoadError(err.message);
                    store.setLoading(false);
                    reject(err);
                };

                // Determine WASM path — files must be in public/ directory
                const wasmPath = import.meta.env.BASE_URL || '/';

                this.worker.postMessage(
                    {
                        type: 'parse',
                        fileBuffer: buffer,
                        wasmPath,
                    },
                    [buffer]
                );
            });
        } catch (err: any) {
            store.setLoadError(err.message);
            store.setLoading(false);
            uiStore.showSnackbar(`Failed to load: ${err.message}`, 'error');
            throw err;
        }
    }

    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

export const ifcLoader = new IfcLoaderService();
