import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/schemas/index.ts', 'src/schemas/server.ts', 'src/config/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['react']
});
