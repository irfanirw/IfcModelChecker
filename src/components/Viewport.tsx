import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Box } from '@mui/material';
import { SceneManager } from '@/viewer/SceneManager';
import { useSelectionStore, useViewStore, useVisibilityStore, useModelStore } from '@/store';
import SectionPanel from '@/components/SectionPanel';

export const ViewportContext = React.createContext<SceneManager | null>(null);

export default function Viewport() {
    const containerRef = useRef<HTMLDivElement>(null);
    const axisCanvasRef = useRef<HTMLCanvasElement>(null);
    const sceneManagerRef = useRef<SceneManager | null>(null);
    const [sceneReady, setSceneReady] = useState(false);

    const { selectedIDs } = useSelectionStore();
    const { gridVisible, worldAxisVisible, display, projection } = useViewStore();
    const { hiddenIDs, isolatedIDs } = useVisibilityStore();
    const geometries = useModelStore((s) => s.geometries);

    // Initialize scene
    useEffect(() => {
        if (!containerRef.current) return;

        const sm = new SceneManager(containerRef.current);
        sceneManagerRef.current = sm;
        setSceneReady(true);

        // Store ref globally for other components to access
        (window as any).__sceneManager = sm;

        return () => {
            sm.dispose();
            sceneManagerRef.current = null;
            (window as any).__sceneManager = null;
        };
    }, []);

    // Load geometry into the 3D scene when it arrives from the worker
    useEffect(() => {
        const sm = sceneManagerRef.current;
        if (!sm || geometries.length === 0) return;
        try {
            sm.loadGeometries(geometries);
        } catch (err) {
            console.error('[Viewport] Failed to load geometries into scene:', err);
        }
    }, [geometries]);

    // Update selection highlighting
    useEffect(() => {
        const sm = sceneManagerRef.current;
        if (sm) {
            sm.highlightSelected(selectedIDs);
        }
    }, [selectedIDs]);

    // Update grid visibility
    useEffect(() => {
        const sm = sceneManagerRef.current;
        if (sm) sm.setGridVisible(gridVisible);
    }, [gridVisible]);

    // Update world axis visibility
    useEffect(() => {
        const sm = sceneManagerRef.current;
        if (sm) sm.setWorldAxisVisible(worldAxisVisible);
    }, [worldAxisVisible]);

    // Update display mode
    useEffect(() => {
        const sm = sceneManagerRef.current;
        if (sm) sm.setDisplayMode(display);
    }, [display]);

    // Update projection mode
    useEffect(() => {
        const sm = sceneManagerRef.current;
        if (sm) sm.setProjection(projection);
    }, [projection]);

    // Update visibility (hide/isolate)
    useEffect(() => {
        const sm = sceneManagerRef.current;
        if (!sm) return;

        if (isolatedIDs !== null) {
            sm.isolateElements(isolatedIDs);
        } else {
            sm.showAllElements();
            if (hiddenIDs.size > 0) {
                sm.hideElements(Array.from(hiddenIDs));
            }
        }
    }, [hiddenIDs, isolatedIDs]);

    // Render axis helper in corner
    useEffect(() => {
        if (!sceneReady || !axisCanvasRef.current) return;

        const sm = sceneManagerRef.current;
        if (!sm) return;

        let animId: number;
        const renderHelper = () => {
            animId = requestAnimationFrame(renderHelper);
            sm.renderAxisHelper(axisCanvasRef.current!);
        };
        renderHelper();

        return () => cancelAnimationFrame(animId);
    }, [sceneReady]);

    return (
        <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
            <div
                ref={containerRef}
                style={{ width: '100%', height: '100%' }}
                data-testid="viewport-container"
            />

            {/* Section Panel — floating overlay */}
            <SectionPanel />

            {/* Axis Helper — bottom-left corner */}
            <canvas
                ref={axisCanvasRef}
                width={120}
                height={120}
                style={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    pointerEvents: 'none',
                    zIndex: 10,
                }}
                data-testid="axis-helper"
            />
        </Box>
    );
}

// Hook for accessing SceneManager from other components
export function useSceneManager(): SceneManager | null {
    return (window as any).__sceneManager || null;
}
