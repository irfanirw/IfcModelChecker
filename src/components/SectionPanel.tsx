/**
 * SectionPanel — Draggable floating panel for the Section (clipping plane) tool.
 *
 * Controls:
 *  - Plane axis selector (X / Y / Z)
 *  - Enable / Disable toggle
 *  - Show cap/fill toggle (default ON)
 *  - Flip direction toggle
 *  - Gumball axis selector (X / Y / Z)
 *  - Reset to model center
 *  - Clear section
 */
import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Switch,
    ToggleButton,
    ToggleButtonGroup,
    Button,
    Tooltip,
    Divider,
    Paper,
} from '@mui/material';
import {
    Close as CloseIcon,
    SwapVert as FlipIcon,
    RestartAlt as ResetIcon,
    Delete as ClearIcon,
    DragIndicator as DragIcon,
} from '@mui/icons-material';
import { useSectionStore } from '@/store';
import type { PlaneAxis, GumballAxis } from '@/viewer/SectionTool';

export default function SectionPanel() {
    const {
        panelOpen,
        enabled,
        planeAxis,
        gumballAxis,
        flipped,
        capVisible,
        setPanelOpen,
        setEnabled,
        setPlaneAxis,
        setGumballAxis,
        setFlipped,
        setCapVisible,
        resetSection,
    } = useSectionStore();

    // Draggable position
    const [pos, setPos] = useState({ x: 60, y: 80 });
    const dragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        dragging.current = true;
        dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        e.preventDefault();
    }, [pos]);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!dragging.current) return;
            setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
        };
        const onMouseUp = () => { dragging.current = false; };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    // Get the scene manager to call SectionTool methods
    const getSectionTool = useCallback(() => {
        const sm = (window as any).__sceneManager;
        return sm?.sectionTool ?? null;
    }, []);

    // --- Handlers ---

    const handleToggleEnabled = useCallback((checked: boolean) => {
        const tool = getSectionTool();
        if (!tool) return;

        setEnabled(checked);
        if (checked) {
            tool.enable(planeAxis);
            tool.setGumballAxis(gumballAxis);
            tool.setCapVisible(capVisible);
        } else {
            tool.disable();
        }
    }, [planeAxis, gumballAxis, capVisible]);

    const handlePlaneAxisChange = useCallback((_: any, val: PlaneAxis | null) => {
        if (!val) return;
        setPlaneAxis(val);
        setFlipped(false);

        const tool = getSectionTool();
        if (tool && enabled) {
            tool.setPlaneAxis(val);
        }
    }, [enabled]);

    const handleGumballAxisChange = useCallback((_: any, val: GumballAxis | null) => {
        if (!val) return;
        setGumballAxis(val);

        const tool = getSectionTool();
        if (tool && enabled) {
            tool.setGumballAxis(val);
        }
    }, [enabled]);

    const handleFlip = useCallback(() => {
        setFlipped(!flipped);
        const tool = getSectionTool();
        if (tool && enabled) {
            tool.flipNormal();
        }
    }, [flipped, enabled]);

    const handleCapToggle = useCallback((checked: boolean) => {
        setCapVisible(checked);
        const tool = getSectionTool();
        if (tool && enabled) {
            tool.setCapVisible(checked);
        }
    }, [enabled]);

    const handleReset = useCallback(() => {
        setFlipped(false);
        const tool = getSectionTool();
        if (tool && enabled) {
            tool.resetToCenter();
        }
    }, [enabled]);

    const handleClear = useCallback(() => {
        resetSection();
        const tool = getSectionTool();
        if (tool) {
            tool.clear();
        }
    }, []);

    const handleClose = useCallback(() => {
        // Clear the section tool so the clipping plane / helper are removed
        const tool = getSectionTool();
        if (tool) {
            tool.clear();
        }
        resetSection();
        setPanelOpen(false);
    }, []);

    if (!panelOpen) return null;

    return (
        <Paper
            elevation={6}
            sx={{
                position: 'absolute',
                top: pos.y,
                left: pos.x,
                zIndex: 1200,
                width: 260,
                borderRadius: 2,
                overflow: 'hidden',
                userSelect: 'none',
            }}
        >
            {/* Draggable header */}
            <Box
                onMouseDown={onMouseDown}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 1,
                    py: 0.5,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    cursor: 'grab',
                    '&:active': { cursor: 'grabbing' },
                }}
            >
                <DragIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.7 }} />
                <Typography variant="subtitle2" sx={{ flex: 1 }}>Section</Typography>
                <IconButton size="small" onClick={handleClose} sx={{ color: 'inherit' }}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>

            <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {/* Enable toggle */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Enable Section</Typography>
                    <Switch
                        size="small"
                        checked={enabled}
                        onChange={(_, v) => handleToggleEnabled(v)}
                    />
                </Box>

                <Divider />

                {/* Plane axis */}
                <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom>Plane Axis</Typography>
                    <ToggleButtonGroup
                        value={planeAxis}
                        exclusive
                        onChange={handlePlaneAxisChange}
                        size="small"
                        fullWidth
                        disabled={!enabled}
                    >
                        <ToggleButton value="X">X (YZ)</ToggleButton>
                        <ToggleButton value="Y">Y (XZ)</ToggleButton>
                        <ToggleButton value="Z">Z (XY)</ToggleButton>
                    </ToggleButtonGroup>
                </Box>

                {/* Gumball axis */}
                <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom>Gumball Axis</Typography>
                    <ToggleButtonGroup
                        value={gumballAxis}
                        exclusive
                        onChange={handleGumballAxisChange}
                        size="small"
                        fullWidth
                        disabled={!enabled}
                    >
                        <ToggleButton value="X">X</ToggleButton>
                        <ToggleButton value="Y">Y</ToggleButton>
                        <ToggleButton value="Z">Z</ToggleButton>
                    </ToggleButtonGroup>
                </Box>

                <Divider />

                {/* Cap / fill toggle */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Show Cap Fill</Typography>
                    <Switch
                        size="small"
                        checked={capVisible}
                        onChange={(_, v) => handleCapToggle(v)}
                        disabled={!enabled}
                    />
                </Box>

                {/* Flip direction */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Flip Direction</Typography>
                    <Tooltip title="Invert clipping normal">
                        <span>
                            <IconButton
                                size="small"
                                onClick={handleFlip}
                                disabled={!enabled}
                                color={flipped ? 'primary' : 'default'}
                            >
                                <FlipIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>

                <Divider />

                {/* Reset + Clear buttons */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ResetIcon />}
                        onClick={handleReset}
                        disabled={!enabled}
                        sx={{ flex: 1 }}
                    >
                        Reset
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        startIcon={<ClearIcon />}
                        onClick={handleClear}
                        sx={{ flex: 1 }}
                    >
                        Clear
                    </Button>
                </Box>
            </Box>
        </Paper>
    );
}
