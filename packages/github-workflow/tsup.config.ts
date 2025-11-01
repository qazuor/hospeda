import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    outDir: 'dist',
    target: 'es2022',
    format: ['esm'],
    splitting: false,
    sourcemap: true,
    clean: true,
    dts: true,
    bundle: true,
    tsconfig: './tsconfig.json',
    noExternal: [/@repo\/.*/],
    esbuildOptions(options) {
        options.resolveExtensions = ['.ts', '.js', '.json'];
    }
});
