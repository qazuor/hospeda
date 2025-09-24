import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/scripts/*.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'node18',
    splitting: false,
    bundle: true,
    external: ['@repo/config', '@repo/logger']
});
