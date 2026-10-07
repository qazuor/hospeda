import { defineConfig } from 'tsup';

export default defineConfig({
    // Two entries: the production surface, and the test-only `./testing`
    // subpath (simulators and shared case sets) that no production build imports.
    entry: { index: 'src/index.ts', 'testing/index': 'src/testing/index.ts' },
    outDir: 'dist',
    target: 'es2022',
    format: ['esm', 'cjs'],
    // Shared chunks, so `.` and `./testing` share ONE copy of each schema and
    // of `ContractValidationError` (an `instanceof` across the two entries holds).
    splitting: true,
    sourcemap: true,
    clean: true,
    dts: process.env.SKIP_PACKAGE_DTS !== 'true',
    bundle: true,
    tsconfig: './tsconfig.json',
    esbuildOptions(options) {
        options.resolveExtensions = ['.ts', '.js', '.json'];
    }
});
