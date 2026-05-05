import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/schemas/index.ts', 'src/schemas/server.ts', 'src/config/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['react'],
    // Include CSS files (tokens.css and CSS Modules) in the bundle.
    // tsup copies .css files to dist; CSS Modules are inlined into JS.
    injectStyle: false
});
