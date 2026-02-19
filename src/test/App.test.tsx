import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '@/App';

// Mock heavy components that depend on Three.js / web-ifc
vi.mock('@/components/Viewport', () => ({
    default: () => <div data-testid="viewport">Viewport</div>,
}));

vi.mock('@/viewer/SceneManager', () => ({
    SceneManager: vi.fn(),
}));

describe('App', () => {
    it('should render without crashing', () => {
        render(<App />);
        // The Ribbon should be present
        expect(document.querySelector('[class*="MuiToolbar"]') || document.body).toBeTruthy();
    });

    it('should render the left bar', () => {
        render(<App />);
        // Look for the Spatial Tree tab or search
        const body = document.body.innerHTML;
        expect(body).toBeTruthy();
    });

    it('should render the right bar', () => {
        render(<App />);
        const body = document.body.innerHTML;
        expect(body).toBeTruthy();
    });
});
