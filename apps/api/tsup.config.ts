import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    outDir: 'dist',
    target: 'es2022',
    format: ['esm', 'cjs'],
    splitting: false,
    sourcemap: true,
    clean: true,
    dts: true,
    bundle: true,
    tsconfig: './tsconfig.json',
    noExternal: [
        /@repo\/.*/,
        '@repo/config',
        '@repo/db',
        '@repo/logger',
        '@repo/schemas',
        '@repo/types',
        '@repo/utils',
        '@repo/service-core',
        '@repo/seed'
    ],
    esbuildOptions(options) {
        options.resolveExtensions = ['.ts', '.js', '.json'];
    }
});
