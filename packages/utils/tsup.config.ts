import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/safe-fetch.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['@repo/logger', '@repo/config']
});
