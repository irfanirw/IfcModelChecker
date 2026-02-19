/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    worker: {
        format: 'es',
    },
    optimizeDeps: {
        exclude: ['web-ifc'],
    },
    assetsInclude: ['**/*.wasm'],
    server: {
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        css: false,
        deps: {
            optimizer: {
                web: {
                    include: [],
                },
            },
        },
    },
});
