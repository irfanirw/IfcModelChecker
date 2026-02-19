import React, { useCallback } from 'react';
import { Box, Snackbar, Alert } from '@mui/material';
import { useUIStore, useModelStore } from '@/store';
import Ribbon from '@/components/Ribbon';
import LeftBar from '@/components/LeftBar';
import RightBar from '@/components/RightBar';
import Viewport from '@/components/Viewport';
import UploadDialog from '@/components/UploadDialog';
import ExportDialog from '@/components/ExportDialog';
import ValidationDialog from '@/components/ValidationDialog';
import LoadingOverlay from '@/components/LoadingOverlay';

const LEFT_BAR_WIDTH = 300;
const RIGHT_BAR_WIDTH = 340;

export default function App() {
    const { snackbar, hideSnackbar, leftBarOpen, rightBarOpen } = useUIStore();
    const { isLoading } = useModelStore();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
            {/* Ribbon */}
            <Ribbon />

            {/* Main content */}
            <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
                {/* Left Bar */}
                {leftBarOpen && (
                    <Box
                        sx={{
                            width: LEFT_BAR_WIDTH,
                            minWidth: LEFT_BAR_WIDTH,
                            borderRight: '1px solid',
                            borderColor: 'divider',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            bgcolor: 'background.paper',
                        }}
                    >
                        <LeftBar />
                    </Box>
                )}

                {/* Viewport */}
                <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <Viewport />
                    {isLoading && <LoadingOverlay />}
                </Box>

                {/* Right Bar */}
                {rightBarOpen && (
                    <Box
                        sx={{
                            width: RIGHT_BAR_WIDTH,
                            minWidth: RIGHT_BAR_WIDTH,
                            borderLeft: '1px solid',
                            borderColor: 'divider',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            bgcolor: 'background.paper',
                        }}
                    >
                        <RightBar />
                    </Box>
                )}
            </Box>

            {/* Upload Dialog */}
            <UploadDialog />

            {/* Export Dialog */}
            <ExportDialog />

            {/* Validation Dialog */}
            <ValidationDialog />

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={5000}
                onClose={hideSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={hideSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
