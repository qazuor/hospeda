import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: process.env.SKIP_PACKAGE_DTS !== 'true',
    clean: true,
    sourcemap: true
});
