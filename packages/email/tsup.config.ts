import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: process.env.SKIP_PACKAGE_DTS !== 'true',
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ['react']
});
