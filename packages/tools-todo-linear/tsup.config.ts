import { defineConfig } from 'tsup';

export default defineConfig([
    // Library build with DTS
    {
        entry: ['src/index.ts'],
        format: ['esm'],
        dts: true,
        clean: true,
        sourcemap: true,
        target: 'node18',
        splitting: false,
        bundle: true,
        external: ['@repo/config', '@repo/logger'],
        outDir: 'dist'
    },
    // Scripts build without DTS (since they contain shebangs)
    {
        entry: ['src/scripts/*.ts'],
        format: ['esm'],
        dts: false, // No DTS for executable scripts
        clean: false, // Don't clean since we're building to same dir
        sourcemap: true,
        target: 'node18',
        splitting: false,
        bundle: true,
        external: ['@repo/config', '@repo/logger'],
        outDir: 'dist'
    }
]);
