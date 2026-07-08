import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: process.env.SKIP_PACKAGE_DTS !== 'true',
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: true
});
