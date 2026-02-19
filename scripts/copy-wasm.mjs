/**
 * Copies web-ifc WASM files to public/ directory
 * Run via: node scripts/copy-wasm.mjs
 */
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const publicDir = resolve(root, 'public');
const webIfcDir = resolve(root, 'node_modules', 'web-ifc');

if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
}

const files = ['web-ifc.wasm', 'web-ifc-mt.wasm'];

for (const file of files) {
    const src = resolve(webIfcDir, file);
    const dest = resolve(publicDir, file);
    if (existsSync(src)) {
        copyFileSync(src, dest);
        console.log(`Copied ${file} → public/`);
    } else {
        console.warn(`Warning: ${file} not found in node_modules/web-ifc/`);
    }
}
