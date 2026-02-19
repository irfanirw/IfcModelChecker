import React, { useState, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    FormControlLabel,
    Switch,
    Alert,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import { useUIStore } from '@/store';
import { downloadModifiedIfc, hasModifications } from '@/services/ifcExport';

export default function ExportDialog() {
    const { exportDialogOpen, setExportDialogOpen, showSnackbar } = useUIStore();
    const [forceRewrite, setForceRewrite] = useState(false);
    const [exporting, setExporting] = useState(false);

    const modified = hasModifications();

    const handleExport = useCallback(async () => {
        setExporting(true);
        try {
            await downloadModifiedIfc(undefined, forceRewrite);
            showSnackbar('IFC exported successfully', 'success');
            setExportDialogOpen(false);
        } catch (err: any) {
            showSnackbar(`Export failed: ${err.message}`, 'error');
        } finally {
            setExporting(false);
        }
    }, [forceRewrite]);

    return (
        <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Export Modified IFC</DialogTitle>
            <DialogContent>
                {!modified ? (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        No modifications detected. The exported file will be identical to the original.
                    </Alert>
                ) : (
                    <Alert severity="success" sx={{ mb: 2 }}>
                        Modified properties will be saved to the exported file.
                    </Alert>
                )}

                <Typography variant="body2" gutterBottom>
                    Export will attempt <strong>patch mode</strong> first (minimal formatting changes).
                    If patching fails, it will fall back to <strong>rewrite mode</strong>.
                </Typography>

                <Box sx={{ mt: 2 }}>
                    <FormControlLabel
                        control={<Switch checked={forceRewrite} onChange={(e) => setForceRewrite(e.target.checked)} />}
                        label="Force rewrite mode (warning: formatting may change)"
                    />
                </Box>

                {forceRewrite && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        Rewrite mode will regenerate the STEP structure. Formatting may change, but header comments will be preserved.
                    </Alert>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
                <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    onClick={handleExport}
                    disabled={exporting}
                >
                    {exporting ? 'Exporting...' : 'Export IFC'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
