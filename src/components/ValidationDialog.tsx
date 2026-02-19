import React, { useState, useCallback, useMemo } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    LinearProgress,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Paper,
    IconButton,
    Tooltip,
} from '@mui/material';
import {
    PlayArrow as RunIcon,
    Upload as ImportIcon,
    Download as DownloadIcon,
    CenterFocusStrong as ZoomIcon,
    PictureAsPdf as PdfIcon,
    TableChart as XlsxIcon,
} from '@mui/icons-material';
import {
    useUIStore,
    useValidationStore,
    useSelectionStore,
    useModelStore,
} from '@/store';
import { validationService } from '@/services/validationService';
import { IFCSG_RULE_PACK_V1 } from '@/services/defaultRulePack';
import { parseIdsXml, idsToRulePack } from '@/services/idsParser';
import { downloadXlsxReport } from '@/services/xlsxReport';
import { downloadPdfReport } from '@/services/pdfReport';
import type { ValidationIssue, RulePack } from '@/types';

export default function ValidationDialog() {
    const {
        validationDialogOpen,
        setValidationDialogOpen,
        showSnackbar,
    } = useUIStore();
    const validationStore = useValidationStore();
    const selectionStore = useSelectionStore();
    const [selectedPack, setSelectedPack] = useState('IFC+SG Default');
    const [tab, setTab] = useState(0);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Available rule packs
    const allPacks: RulePack[] = useMemo(() => {
        return [IFCSG_RULE_PACK_V1, ...validationStore.rulePacks];
    }, [validationStore.rulePacks]);

    const handleRunValidation = useCallback(async () => {
        const pack = allPacks.find((p) => p.name === selectedPack);
        if (!pack) {
            showSnackbar('No rule pack selected', 'warning');
            return;
        }

        try {
            await validationService.validate(pack);
            setTab(1); // Switch to results tab
        } catch {
            // Error handled in service
        }
    }, [selectedPack, allPacks]);

    const handleImportIds = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const specs = parseIdsXml(text);
            const pack = idsToRulePack(specs, file.name);
            validationStore.addRulePack(pack);
            setSelectedPack(pack.name);
            showSnackbar(`Imported IDS: ${pack.rules.length} rules from "${file.name}"`, 'success');
        } catch (err: any) {
            showSnackbar(`IDS import failed: ${err.message}`, 'error');
        }

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const handleIssueClick = useCallback((issue: ValidationIssue) => {
        selectionStore.select(issue.expressID);
        const sm = (window as any).__sceneManager;
        if (sm) {
            sm.zoomToSelection(new Set([issue.expressID]));
        }
    }, []);

    const handleExportXlsx = useCallback(async () => {
        const result = validationStore.validationResult;
        if (!result) return;
        try {
            await downloadXlsxReport(result);
            showSnackbar('XLSX report downloaded', 'success');
        } catch (err: any) {
            showSnackbar(`XLSX export failed: ${err.message}`, 'error');
        }
    }, [validationStore.validationResult]);

    const handleExportPdf = useCallback(async () => {
        const result = validationStore.validationResult;
        if (!result) return;
        try {
            await downloadPdfReport(result);
            showSnackbar('PDF report downloaded', 'success');
        } catch (err: any) {
            showSnackbar(`PDF export failed: ${err.message}`, 'error');
        }
    }, [validationStore.validationResult]);

    const result = validationStore.validationResult;

    return (
        <Dialog
            open={validationDialogOpen}
            onClose={() => setValidationDialogOpen(false)}
            maxWidth="lg"
            fullWidth
            PaperProps={{ sx: { height: '80vh' } }}
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="h6">Validation</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        {result && (
                            <>
                                <Tooltip title="Export XLSX">
                                    <IconButton onClick={handleExportXlsx}><XlsxIcon /></IconButton>
                                </Tooltip>
                                <Tooltip title="Export PDF">
                                    <IconButton onClick={handleExportPdf}><PdfIcon /></IconButton>
                                </Tooltip>
                            </>
                        )}
                    </Box>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tab label="Configuration" />
                    <Tab label={`Results ${result ? `(${result.totalIssues})` : ''}`} />
                </Tabs>

                {/* Config Tab */}
                {tab === 0 && (
                    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>Rule Pack</InputLabel>
                            <Select value={selectedPack} label="Rule Pack" onChange={(e) => setSelectedPack(e.target.value)}>
                                {allPacks.map((p) => (
                                    <MenuItem key={p.name} value={p.name}>
                                        {p.name} (v{p.version}) — {p.rules.length} rules
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="contained"
                                startIcon={<RunIcon />}
                                onClick={handleRunValidation}
                                disabled={validationStore.isValidating}
                            >
                                Run Validation
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<ImportIcon />}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                Import IDS XML
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xml,.ids"
                                style={{ display: 'none' }}
                                onChange={handleImportIds}
                            />
                        </Box>

                        {validationStore.isValidating && (
                            <Box>
                                <Typography variant="body2">Validating...</Typography>
                                <LinearProgress variant="determinate" value={validationStore.validationProgress} />
                            </Box>
                        )}

                        {/* Selected pack info */}
                        {selectedPack && (
                            <Box>
                                <Typography variant="subtitle2">
                                    {allPacks.find((p) => p.name === selectedPack)?.description || ''}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                )}

                {/* Results Tab */}
                {tab === 1 && (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {!result ? (
                            <Box sx={{ p: 4, textAlign: 'center' }}>
                                <Typography color="text.secondary">No validation results yet. Run validation first.</Typography>
                            </Box>
                        ) : (
                            <>
                                {/* Summary */}
                                <Box sx={{ p: 1, display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: 1, borderColor: 'divider' }}>
                                    <Chip label={`Total: ${result.totalIssues}`} />
                                    <Chip label={`Errors: ${result.errors}`} color="error" />
                                    <Chip label={`Warnings: ${result.warnings}`} color="warning" />
                                    <Chip label={`Passed: ${result.passed}/${result.totalElements}`} color="success" />
                                </Box>

                                {/* Issues Table */}
                                <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto' }}>
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Severity</TableCell>
                                                <TableCell>Element</TableCell>
                                                <TableCell>Class</TableCell>
                                                <TableCell>Level</TableCell>
                                                <TableCell>Rule</TableCell>
                                                <TableCell>Property</TableCell>
                                                <TableCell>Expected</TableCell>
                                                <TableCell>Actual</TableCell>
                                                <TableCell>Action</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {result.issues.map((issue, idx) => (
                                                <TableRow
                                                    key={issue.id || idx}
                                                    hover
                                                    sx={{ cursor: 'pointer' }}
                                                    onClick={() => handleIssueClick(issue)}
                                                >
                                                    <TableCell>
                                                        <Chip
                                                            label={issue.severity}
                                                            size="small"
                                                            color={issue.severity === 'Error' ? 'error' : 'warning'}
                                                            sx={{ height: 20, fontSize: 10 }}
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ maxWidth: 120 }}>
                                                        <Typography variant="caption" noWrap>{issue.elementId}</Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="caption">{issue.ifcClass}</Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="caption" noWrap>{issue.level}</Typography>
                                                    </TableCell>
                                                    <TableCell sx={{ maxWidth: 150 }}>
                                                        <Typography variant="caption" noWrap>{issue.ruleName}</Typography>
                                                    </TableCell>
                                                    <TableCell sx={{ maxWidth: 140 }}>
                                                        <Typography variant="caption" noWrap>{issue.propertyPath}</Typography>
                                                    </TableCell>
                                                    <TableCell sx={{ maxWidth: 120 }}>
                                                        <Typography variant="caption" noWrap>{issue.expected}</Typography>
                                                    </TableCell>
                                                    <TableCell sx={{ maxWidth: 100 }}>
                                                        <Typography variant="caption" noWrap>{issue.actual}</Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Tooltip title="Zoom to element">
                                                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleIssueClick(issue); }}>
                                                                <ZoomIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </>
                        )}
                    </Box>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={() => setValidationDialogOpen(false)}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
