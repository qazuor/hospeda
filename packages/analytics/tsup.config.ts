import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    outDir: 'dist',
    target: 'es2022',
    format: ['esm'],
    splitting: false,
    sourcemap: true,
    clean: true,
    dts: process.env.SKIP_PACKAGE_DTS !== 'true',
    bundle: true,
    tsconfig: './tsconfig.json'
});
