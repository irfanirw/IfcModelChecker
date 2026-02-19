import React, { useCallback, useRef, useState } from 'react';
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
} from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import { useUIStore, useModelStore } from '@/store';
import { ifcLoader } from '@/services/ifcLoader';

export default function UploadDialog() {
    const { uploadDialogOpen, setUploadDialogOpen, showSnackbar } = useUIStore();
    const { isLoading, loadProgress, loadError } = useModelStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const handleFile = useCallback(async (file: File) => {
        if (!file.name.toLowerCase().endsWith('.ifc')) {
            showSnackbar('Please select an .ifc file', 'warning');
            return;
        }

        try {
            await ifcLoader.loadFile(file);
            setUploadDialogOpen(false);
        } catch {
            // Error handled in loader
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOver(false);
    }, []);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

    return (
        <Dialog
            open={uploadDialogOpen}
            onClose={() => !isLoading && setUploadDialogOpen(false)}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>Upload IFC Model</DialogTitle>
            <DialogContent>
                {loadError && (
                    <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>
                )}

                {isLoading ? (
                    <Box sx={{ py: 4 }}>
                        <Typography variant="body2" gutterBottom>Loading model...</Typography>
                        <LinearProgress variant="determinate" value={loadProgress} />
                        <Typography variant="caption" color="text.secondary">{loadProgress}%</Typography>
                    </Box>
                ) : (
                    <Box
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                        sx={{
                            border: '2px dashed',
                            borderColor: dragOver ? 'primary.main' : 'divider',
                            borderRadius: 2,
                            p: 4,
                            textAlign: 'center',
                            cursor: 'pointer',
                            bgcolor: dragOver ? 'action.hover' : 'transparent',
                            transition: 'all 0.2s',
                            '&:hover': { bgcolor: 'action.hover' },
                        }}
                    >
                        <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                        <Typography variant="body1">
                            Drag & drop an IFC file here, or click to browse
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Supports .ifc files (up to ~800MB best effort)
                        </Typography>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".ifc"
                            style={{ display: 'none' }}
                            onChange={handleInputChange}
                        />
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setUploadDialogOpen(false)} disabled={isLoading}>
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    );
}
