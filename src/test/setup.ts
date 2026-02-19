import '@testing-library/jest-dom';

// Mock Web Workers
class MockWorker {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: ErrorEvent) => void) | null = null;

    postMessage(_data: any) {
        // No-op in tests
    }

    terminate() {
        // No-op
    }

    addEventListener() { }
    removeEventListener() { }
    dispatchEvent() { return false; }
}

(globalThis as any).Worker = MockWorker;

// Mock ResizeObserver
class MockResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
}

(globalThis as any).ResizeObserver = MockResizeObserver;

// Mock URL.createObjectURL
URL.createObjectURL = vi.fn(() => 'blob:mock-url');
URL.revokeObjectURL = vi.fn();

// Mock canvas context
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(),
    putImageData: vi.fn(),
    createImageData: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    canvas: { width: 100, height: 100 },
});

// Mock WebGL
HTMLCanvasElement.prototype.getContext = vi.fn((contextId: string) => {
    if (contextId === 'webgl' || contextId === 'webgl2') {
        return {
            getExtension: vi.fn(),
            getParameter: vi.fn(() => 0),
            createShader: vi.fn(),
            createProgram: vi.fn(),
            attachShader: vi.fn(),
            linkProgram: vi.fn(),
            getProgramParameter: vi.fn(() => true),
            getShaderParameter: vi.fn(() => true),
            shaderSource: vi.fn(),
            compileShader: vi.fn(),
            useProgram: vi.fn(),
            createBuffer: vi.fn(),
            bindBuffer: vi.fn(),
            bufferData: vi.fn(),
            enable: vi.fn(),
            disable: vi.fn(),
            viewport: vi.fn(),
            clear: vi.fn(),
            clearColor: vi.fn(),
            drawArrays: vi.fn(),
            drawElements: vi.fn(),
            createTexture: vi.fn(),
            bindTexture: vi.fn(),
            texImage2D: vi.fn(),
            texParameteri: vi.fn(),
            getUniformLocation: vi.fn(),
            getAttribLocation: vi.fn(),
            enableVertexAttribArray: vi.fn(),
            vertexAttribPointer: vi.fn(),
            uniform1i: vi.fn(),
            uniform1f: vi.fn(),
            uniform2f: vi.fn(),
            uniform3f: vi.fn(),
            uniform4f: vi.fn(),
            uniformMatrix4fv: vi.fn(),
            canvas: { width: 100, height: 100 },
            drawingBufferWidth: 100,
            drawingBufferHeight: 100,
        };
    }
    return null;
}) as any;
