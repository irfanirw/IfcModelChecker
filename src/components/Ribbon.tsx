import React, { useCallback } from 'react';
import {
    Box,
    IconButton,
    Tooltip,
    Divider,
    ToggleButton,
    ToggleButtonGroup,
    Button,
} from '@mui/material';
import {
    Upload as UploadIcon,
    GridOn as GridIcon,
    GridOff as GridOffIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    CenterFocusStrong as FitIcon,
    FilterCenterFocus as ZoomSelIcon,
    Deselect as DeselectIcon,
    ViewInAr as PerspectiveIcon,
    CropFree as ParallelIcon,
    Brush as ShadedIcon,
    Polyline as WireframeIcon,
    ArrowUpward as TopIcon,
    ArrowForward as RightIcon,
    ArrowBack as LeftIcon,
    ArrowDownward as FrontIcon,
    SwapHoriz as BackIcon,
    RestartAlt as ResetIcon,
    Download as ExportIcon,
    PlayArrow as ValidateIcon,
    ChevronLeft as ToggleLeftIcon,
    ChevronRight as ToggleRightIcon,
} from '@mui/icons-material';
import { SvgIcon } from '@mui/material';

import {
    useViewStore,
    useUIStore,
    useSelectionStore,
    useVisibilityStore,
    useModelStore,
} from '@/store';
import { useSceneManager } from '@/components/Viewport';
import type { ViewPreset, ProjectionMode, DisplayMode } from '@/types';

// Custom "XYZ" text icon for the World Axis toggle
function XyzIcon(props: any) {
    return (
        <SvgIcon {...props} viewBox="0 0 24 24">
            <text x="12" y="16" textAnchor="middle" fontWeight="bold" fontSize="10" fill="currentColor">XYZ</text>
        </SvgIcon>
    );
}

export default function Ribbon() {
    const viewStore = useViewStore();
    const uiStore = useUIStore();
    const selectionStore = useSelectionStore();
    const visibilityStore = useVisibilityStore();
    const modelStore = useModelStore();

    const handleViewPreset = useCallback((preset: ViewPreset) => {
        viewStore.setPreset(preset);
        const sm = (window as any).__sceneManager;
        if (sm) sm.setViewPreset(preset);
    }, []);

    const handleFit = useCallback(() => {
        const sm = (window as any).__sceneManager;
        if (sm) sm.fitToModel();
    }, []);

    const handleZoomToSelection = useCallback(() => {
        const sm = (window as any).__sceneManager;
        if (sm) sm.zoomToSelection(selectionStore.selectedIDs);
    }, [selectionStore.selectedIDs]);

    const handleIsolate = useCallback(() => {
        const ids = Array.from(selectionStore.selectedIDs);
        if (ids.length > 0) {
            visibilityStore.isolateElements(ids);
        }
    }, [selectionStore.selectedIDs]);

    const handleHide = useCallback(() => {
        const ids = Array.from(selectionStore.selectedIDs);
        if (ids.length > 0) {
            visibilityStore.hideElements(ids);
            selectionStore.clearSelection();
        }
    }, [selectionStore.selectedIDs]);

    const handleUnhideAll = useCallback(() => {
        visibilityStore.unhideAll();
    }, []);

    const handleResetView = useCallback(() => {
        const sm = (window as any).__sceneManager;
        if (sm) {
            sm.fitToModel();
            viewStore.setPreset(null);
            viewStore.setProjection('perspective');
            viewStore.setDisplay('shaded');
            viewStore.setGridVisible(true);
            viewStore.setWorldAxisVisible(true);
        }
    }, []);

    const handleProjectionChange = useCallback((_: any, val: ProjectionMode | null) => {
        if (val) viewStore.setProjection(val);
    }, []);

    const handleDisplayChange = useCallback((_: any, val: DisplayMode | null) => {
        if (val) viewStore.setDisplay(val);
    }, []);

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                px: 1,
                py: 0.3,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                gap: 0.5,
                flexWrap: 'nowrap',
                overflow: 'auto',
                minHeight: 42,
            }}
            data-testid="ribbon"
        >
            {/* Upload */}
            <Tooltip title="Upload IFC">
                <IconButton size="small" onClick={() => uiStore.setUploadDialogOpen(true)} color="primary">
                    <UploadIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Toggle Panels */}
            <Tooltip title="Toggle Left Panel">
                <IconButton size="small" onClick={() => uiStore.setLeftBarOpen(!uiStore.leftBarOpen)}>
                    {uiStore.leftBarOpen ? <ToggleLeftIcon fontSize="small" /> : <ToggleRightIcon fontSize="small" />}
                </IconButton>
            </Tooltip>
            <Tooltip title="Toggle Right Panel">
                <IconButton size="small" onClick={() => uiStore.setRightBarOpen(!uiStore.rightBarOpen)}>
                    {uiStore.rightBarOpen ? <ToggleRightIcon fontSize="small" /> : <ToggleLeftIcon fontSize="small" />}
                </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* View Presets */}
            <Tooltip title="Top View">
                <IconButton size="small" onClick={() => handleViewPreset('top')}>
                    <TopIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title="Front View">
                <IconButton size="small" onClick={() => handleViewPreset('front')}>
                    <FrontIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title="Back View">
                <IconButton size="small" onClick={() => handleViewPreset('back')}>
                    <BackIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title="Left View">
                <IconButton size="small" onClick={() => handleViewPreset('left')}>
                    <LeftIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title="Right View">
                <IconButton size="small" onClick={() => handleViewPreset('right')}>
                    <RightIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Projection Toggle */}
            <ToggleButtonGroup
                value={viewStore.projection}
                exclusive
                onChange={handleProjectionChange}
                size="small"
            >
                <ToggleButton value="perspective" sx={{ px: 1, py: 0.3 }}>
                    <Tooltip title="Perspective"><PerspectiveIcon fontSize="small" /></Tooltip>
                </ToggleButton>
                <ToggleButton value="parallel" sx={{ px: 1, py: 0.3 }}>
                    <Tooltip title="Parallel"><ParallelIcon fontSize="small" /></Tooltip>
                </ToggleButton>
            </ToggleButtonGroup>

            {/* Display Toggle */}
            <ToggleButtonGroup
                value={viewStore.display}
                exclusive
                onChange={handleDisplayChange}
                size="small"
                sx={{ ml: 0.5 }}
            >
                <ToggleButton value="shaded" sx={{ px: 1, py: 0.3 }}>
                    <Tooltip title="Shaded"><ShadedIcon fontSize="small" /></Tooltip>
                </ToggleButton>
                <ToggleButton value="wireframe" sx={{ px: 1, py: 0.3 }}>
                    <Tooltip title="Wireframe"><WireframeIcon fontSize="small" /></Tooltip>
                </ToggleButton>
            </ToggleButtonGroup>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Practical Controls */}
            <Tooltip title="Fit / Zoom Extents">
                <IconButton size="small" onClick={handleFit}>
                    <FitIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title="Zoom to Selection">
                <IconButton size="small" onClick={handleZoomToSelection} disabled={selectionStore.selectedIDs.size === 0}>
                    <ZoomSelIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title="Isolate Selection">
                <IconButton size="small" onClick={handleIsolate} disabled={selectionStore.selectedIDs.size === 0}>
                    <VisibilityIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title="Hide Selection">
                <IconButton size="small" onClick={handleHide} disabled={selectionStore.selectedIDs.size === 0}>
                    <VisibilityOffIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title="Unhide All">
                <IconButton size="small" onClick={handleUnhideAll}>
                    <DeselectIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title="Reset View">
                <IconButton size="small" onClick={handleResetView}>
                    <ResetIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Grid Toggle */}
            <Tooltip title={viewStore.gridVisible ? 'Hide Grid' : 'Show Grid'}>
                <IconButton size="small" onClick={() => viewStore.setGridVisible(!viewStore.gridVisible)}>
                    {viewStore.gridVisible ? <GridIcon fontSize="small" /> : <GridOffIcon fontSize="small" />}
                </IconButton>
            </Tooltip>

            {/* World Axis Toggle */}
            <Tooltip title={viewStore.worldAxisVisible ? 'Hide World Axis' : 'Show World Axis'}>
                <IconButton size="small" onClick={() => viewStore.setWorldAxisVisible(!viewStore.worldAxisVisible)}>
                    <XyzIcon fontSize="small" color={viewStore.worldAxisVisible ? 'primary' : 'inherit'} />
                </IconButton>
            </Tooltip>

            <Box sx={{ flex: 1 }} />

            {/* Export */}
            <Tooltip title="Export Modified IFC">
                <span>
                    <IconButton
                        size="small"
                        onClick={() => uiStore.setExportDialogOpen(true)}
                        disabled={modelStore.elements.size === 0}
                    >
                        <ExportIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>

            {/* Validate */}
            <Tooltip title="Run Validation">
                <span>
                    <Button
                        size="small"
                        variant="contained"
                        startIcon={<ValidateIcon />}
                        onClick={() => uiStore.setValidationDialogOpen(true)}
                        disabled={modelStore.elements.size === 0}
                        sx={{ ml: 0.5 }}
                    >
                        Validate
                    </Button>
                </span>
            </Tooltip>
        </Box>
    );
}
