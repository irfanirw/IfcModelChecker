import React, { useMemo, useState, useCallback } from 'react';
import {
    Box,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    TextField,
    Chip,
    Button,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Divider,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControlLabel,
    Radio,
    RadioGroup,
    IconButton,
    Tooltip,
} from '@mui/material';
import {
    ExpandMore,
    Edit as EditIcon,
    Undo as UndoIcon,
    Save as SaveIcon,
} from '@mui/icons-material';
import {
    useModelStore,
    useSelectionStore,
    useEditHistoryStore,
    useValidationStore,
    useUIStore,
} from '@/store';
import { isPsetCommon } from '@/constants';
import { useSceneManager } from '@/components/Viewport';
import type { IfcElement, PropertySet, Property, PropertyValue, BatchEditOperation, EditAction } from '@/types';

// Helper to format a value in metres to millimetres (1 decimal place)
const fmtMm = (v: number) => (v * 1000).toFixed(1);

// ===== Geometry Info Section =====
function GeometryInfo({ expressID }: { expressID: number }) {
    const sm = useSceneManager();
    const bounds = useMemo(() => sm?.getElementBounds(expressID) ?? null, [sm, expressID]);

    if (!bounds) return null;

    const { position, size } = bounds;

    return (
        <Accordion disableGutters defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 32, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                <Typography variant="body2" fontWeight={500}>Geometry</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Position</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px', ml: 1, mb: 1 }}>
                    <Typography variant="caption">X:</Typography>
                    <Typography variant="caption" color="text.secondary">{fmtMm(position.x)} mm</Typography>
                    <Typography variant="caption">Y:</Typography>
                    <Typography variant="caption" color="text.secondary">{fmtMm(position.y)} mm</Typography>
                    <Typography variant="caption">Z:</Typography>
                    <Typography variant="caption" color="text.secondary">{fmtMm(position.z)} mm</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Size</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px', ml: 1 }}>
                    <Typography variant="caption">Width:</Typography>
                    <Typography variant="caption" color="text.secondary">{fmtMm(size.width)} mm</Typography>
                    <Typography variant="caption">Height:</Typography>
                    <Typography variant="caption" color="text.secondary">{fmtMm(size.height)} mm</Typography>
                    <Typography variant="caption">Depth:</Typography>
                    <Typography variant="caption" color="text.secondary">{fmtMm(size.depth)} mm</Typography>
                </Box>
            </AccordionDetails>
        </Accordion>
    );
}

// ===== Single Element Inspector =====
function SingleInspector({ element }: { element: IfcElement }) {
    const { updatePropertyValue } = useModelStore();
    const { pushEdit } = useEditHistoryStore();
    const issues = useValidationStore((s) => s.getIssuesForElement(element.expressID));

    const handlePropertyChange = useCallback(
        (pset: PropertySet, prop: Property, newValue: PropertyValue) => {
            const oldValues = new Map<number, PropertyValue>();
            oldValues.set(element.expressID, prop.value);

            pushEdit({
                elementIDs: [element.expressID],
                psetName: pset.name,
                propertyName: prop.name,
                oldValues,
                newValue,
                timestamp: Date.now(),
            });

            updatePropertyValue(element.expressID, pset.name, prop.name, newValue);
        },
        [element.expressID]
    );

    return (
        <Box sx={{ p: 1, overflow: 'auto', flex: 1 }}>
            {/* Header info */}
            <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle2" color="primary">{element.ifcClass}</Typography>
                <Typography variant="body2" noWrap><strong>Name:</strong> {element.name || '—'}</Typography>
                <Typography variant="body2" noWrap><strong>GlobalId:</strong> {element.globalId}</Typography>
                <Typography variant="body2" noWrap><strong>Tag:</strong> {element.tag || '—'}</Typography>
                <Typography variant="body2" noWrap><strong>Level:</strong> {element.level || '—'}</Typography>
                <Typography variant="body2" noWrap><strong>Zone:</strong> {element.zone || '—'}</Typography>
                <Typography variant="body2" noWrap>
                    <strong>Discipline:</strong>{' '}
                    <Chip label={element.discipline} size="small" sx={{ height: 18, fontSize: 10 }} />
                </Typography>
            </Box>

            {/* Geometry info (position & size from bounding box) */}
            <GeometryInfo expressID={element.expressID} />

            {/* Validation issues */}
            {issues.length > 0 && (
                <Alert severity="warning" sx={{ mb: 1, py: 0 }}>
                    {issues.length} validation issue{issues.length > 1 ? 's' : ''}
                </Alert>
            )}

            {/* Property Sets */}
            {element.psets.map((pset) => (
                <Accordion key={pset.expressID} defaultExpanded={pset.isEditable} disableGutters>
                    <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 32, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2" fontWeight={500}>{pset.name}</Typography>
                            {pset.isEditable && (
                                <Chip label="Editable" size="small" color="primary" variant="outlined" sx={{ height: 16, fontSize: 9 }} />
                            )}
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                        {pset.properties.map((prop) => (
                            <PropertyRow
                                key={prop.expressID}
                                prop={prop}
                                pset={pset}
                                editable={pset.isEditable}
                                onChange={(newVal) => handlePropertyChange(pset, prop, newVal)}
                            />
                        ))}
                        {pset.properties.length === 0 && (
                            <Typography variant="caption" color="text.secondary">No properties</Typography>
                        )}
                    </AccordionDetails>
                </Accordion>
            ))}
        </Box>
    );
}

// ===== Property Row =====
function PropertyRow({
    prop,
    pset,
    editable,
    onChange,
}: {
    prop: Property;
    pset: PropertySet;
    editable: boolean;
    onChange: (val: PropertyValue) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [tempValue, setTempValue] = useState(String(prop.value ?? ''));

    const handleSave = () => {
        let parsedValue: PropertyValue = tempValue;
        if (tempValue === '') parsedValue = null;
        else if (tempValue === 'true' || tempValue === '.T.') parsedValue = true;
        else if (tempValue === 'false' || tempValue === '.F.') parsedValue = false;
        else if (!isNaN(Number(tempValue)) && tempValue.trim() !== '') parsedValue = Number(tempValue);

        onChange(parsedValue);
        setEditing(false);
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', py: 0.3, gap: 0.5 }}>
            <Typography variant="caption" sx={{ flex: 1, minWidth: 0 }} noWrap title={prop.name}>
                {prop.name}
                {prop.modified && <Chip label="Modified" size="small" color="warning" sx={{ ml: 0.5, height: 14, fontSize: 8 }} />}
            </Typography>
            {editing ? (
                <>
                    <TextField
                        size="small"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
                        sx={{ flex: 1, '& input': { fontSize: 12, py: 0.3 } }}
                        autoFocus
                    />
                    <IconButton size="small" onClick={handleSave}><SaveIcon fontSize="small" /></IconButton>
                </>
            ) : (
                <>
                    <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }} noWrap title={String(prop.value ?? '(empty)')}>
                        {prop.value !== null && prop.value !== undefined ? String(prop.value) : <em>(empty)</em>}
                    </Typography>
                    {editable && (
                        <IconButton size="small" onClick={() => { setTempValue(String(prop.value ?? '')); setEditing(true); }}>
                            <EditIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                    )}
                </>
            )}
        </Box>
    );
}

// ===== Batch Edit Inspector =====
function BatchInspector({ elements }: { elements: IfcElement[] }) {
    const [batchDialogOpen, setBatchDialogOpen] = useState(false);
    const [batchPset, setBatchPset] = useState('');
    const [batchProp, setBatchProp] = useState('');
    const [batchValue, setBatchValue] = useState('');
    const [batchMode, setBatchMode] = useState<'overwrite' | 'fillEmpty'>('overwrite');
    const [confirmOpen, setConfirmOpen] = useState(false);

    const { updatePropertyValue } = useModelStore();
    const { pushEdit } = useEditHistoryStore();
    const uiStore = useUIStore();

    // Find common editable psets and properties
    const commonPsets = useMemo(() => {
        const psetMap = new Map<string, Set<string>>();
        elements.forEach((el) => {
            el.psets.filter((ps) => ps.isEditable).forEach((ps) => {
                const existing = psetMap.get(ps.name) || new Set<string>();
                ps.properties.forEach((p) => existing.add(p.name));
                psetMap.set(ps.name, existing);
            });
        });
        return psetMap;
    }, [elements]);

    const availableProperties = useMemo(() => {
        if (!batchPset) return [];
        return Array.from(commonPsets.get(batchPset) || []);
    }, [batchPset, commonPsets]);

    const handleBatchApply = useCallback(() => {
        if (!batchPset || !batchProp) return;

        // Check if any non-empty values would be overwritten
        if (batchMode === 'overwrite') {
            const hasNonEmpty = elements.some((el) => {
                const pset = el.psets.find((ps) => ps.name === batchPset);
                const prop = pset?.properties.find((p) => p.name === batchProp);
                return prop && prop.value !== null && prop.value !== undefined && prop.value !== '';
            });
            if (hasNonEmpty) {
                setConfirmOpen(true);
                return;
            }
        }

        applyBatchEdit();
    }, [batchPset, batchProp, batchValue, batchMode, elements]);

    const applyBatchEdit = useCallback(() => {
        let parsedValue: PropertyValue = batchValue;
        if (batchValue === '') parsedValue = null;
        else if (batchValue === 'true') parsedValue = true;
        else if (batchValue === 'false') parsedValue = false;
        else if (!isNaN(Number(batchValue)) && batchValue.trim() !== '') parsedValue = Number(batchValue);

        const oldValues = new Map<number, PropertyValue>();

        elements.forEach((el) => {
            const pset = el.psets.find((ps) => ps.name === batchPset);
            const prop = pset?.properties.find((p) => p.name === batchProp);

            if (batchMode === 'fillEmpty') {
                if (prop && (prop.value === null || prop.value === undefined || prop.value === '')) {
                    oldValues.set(el.expressID, prop.value);
                    updatePropertyValue(el.expressID, batchPset, batchProp, parsedValue);
                }
            } else {
                if (prop) {
                    oldValues.set(el.expressID, prop.value);
                }
                updatePropertyValue(el.expressID, batchPset, batchProp, parsedValue);
            }
        });

        pushEdit({
            elementIDs: Array.from(oldValues.keys()),
            psetName: batchPset,
            propertyName: batchProp,
            oldValues,
            newValue: parsedValue,
            timestamp: Date.now(),
        });

        setConfirmOpen(false);
        setBatchDialogOpen(false);
        uiStore.showSnackbar(`Batch edit applied to ${oldValues.size} elements`, 'success');
    }, [batchPset, batchProp, batchValue, batchMode, elements]);

    // Count disciplines
    const disciplineCounts = useMemo(() => {
        const counts = { Architecture: 0, Structure: 0, MEP: 0, Unknown: 0 };
        elements.forEach((el) => { counts[el.discipline]++; });
        return counts;
    }, [elements]);

    return (
        <Box sx={{ p: 1, overflow: 'auto', flex: 1 }}>
            <Typography variant="subtitle2" color="primary">
                {elements.length} Elements Selected
            </Typography>

            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', my: 0.5 }}>
                {Object.entries(disciplineCounts)
                    .filter(([_, count]) => count > 0)
                    .map(([disc, count]) => (
                        <Chip key={disc} label={`${disc}: ${count}`} size="small" sx={{ height: 20, fontSize: 10 }} />
                    ))}
            </Box>

            <Divider sx={{ my: 1 }} />

            <Button
                variant="contained"
                size="small"
                startIcon={<EditIcon />}
                onClick={() => setBatchDialogOpen(true)}
                fullWidth
            >
                Batch Edit Pset_*Common
            </Button>

            {/* Batch Edit Dialog */}
            <Dialog open={batchDialogOpen} onClose={() => setBatchDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Batch Edit — {elements.length} Elements</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <FormControl size="small" fullWidth>
                            <InputLabel>Property Set</InputLabel>
                            <Select value={batchPset} label="Property Set" onChange={(e) => { setBatchPset(e.target.value); setBatchProp(''); }}>
                                {Array.from(commonPsets.keys()).map((name) => (
                                    <MenuItem key={name} value={name}>{name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl size="small" fullWidth disabled={!batchPset}>
                            <InputLabel>Property</InputLabel>
                            <Select value={batchProp} label="Property" onChange={(e) => setBatchProp(e.target.value)}>
                                {availableProperties.map((name) => (
                                    <MenuItem key={name} value={name}>{name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <TextField
                            size="small"
                            label="Value"
                            value={batchValue}
                            onChange={(e) => setBatchValue(e.target.value)}
                            fullWidth
                            disabled={!batchProp}
                        />

                        <FormControl>
                            <Typography variant="caption" gutterBottom>Apply Mode:</Typography>
                            <RadioGroup value={batchMode} onChange={(e) => setBatchMode(e.target.value as 'overwrite' | 'fillEmpty')}>
                                <FormControlLabel value="overwrite" control={<Radio size="small" />} label="Apply to all selected" />
                                <FormControlLabel value="fillEmpty" control={<Radio size="small" />} label="Apply only where empty" />
                            </RadioGroup>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBatchDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleBatchApply} disabled={!batchPset || !batchProp}>
                        Apply
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirm Overwrite Dialog */}
            <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
                <DialogTitle>Confirm Overwrite</DialogTitle>
                <DialogContent>
                    <Typography>
                        Some selected elements have existing non-empty values for <strong>{batchProp}</strong>.
                        Are you sure you want to overwrite them?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                    <Button variant="contained" color="warning" onClick={applyBatchEdit}>
                        Overwrite
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

// ===== Main RightBar =====
export default function RightBar() {
    const { selectedIDs } = useSelectionStore();
    const { elements } = useModelStore();
    const { undo, redo, undoStack, redoStack } = useEditHistoryStore();
    const { updatePropertyValue } = useModelStore();

    const selectedElements = useMemo(() => {
        const result: IfcElement[] = [];
        selectedIDs.forEach((id) => {
            const el = elements.get(id);
            if (el) result.push(el);
        });
        return result;
    }, [selectedIDs, elements]);

    const handleUndo = useCallback(() => {
        const action = undo();
        if (!action) return;
        // Revert values
        action.oldValues.forEach((oldVal, elementID) => {
            updatePropertyValue(elementID, action.psetName, action.propertyName, oldVal);
        });
    }, [undo, updatePropertyValue]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Toolbar */}
            <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ flex: 1 }}>Inspector</Typography>
                <Tooltip title="Undo">
                    <span>
                        <IconButton size="small" onClick={handleUndo} disabled={undoStack.length === 0}>
                            <UndoIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>

            {/* Content */}
            {selectedElements.length === 0 && (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                        Select an element to inspect its properties
                    </Typography>
                </Box>
            )}

            {selectedElements.length === 1 && (
                <SingleInspector element={selectedElements[0]} />
            )}

            {selectedElements.length > 1 && (
                <BatchInspector elements={selectedElements} />
            )}
        </Box>
    );
}
