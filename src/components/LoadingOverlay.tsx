import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import { useModelStore } from '@/store';

export default function LoadingOverlay() {
    const { loadProgress } = useModelStore();

    return (
        <Box
            sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100,
            }}
        >
            <Box sx={{ width: 300, bgcolor: 'background.paper', borderRadius: 2, p: 3, textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom>Loading Model</Typography>
                <LinearProgress variant="determinate" value={loadProgress} sx={{ mb: 1 }} />
                <Typography variant="body2" color="text.secondary">{loadProgress}%</Typography>
            </Box>
        </Box>
    );
}
