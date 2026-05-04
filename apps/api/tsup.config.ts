import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/vercel.ts'],
    outDir: 'dist',
    target: 'es2022',
    format: ['esm', 'cjs'],
    splitting: false,
    sourcemap: true,
    clean: true,
    dts: true,
    bundle: true,
    tsconfig: './tsconfig.json',
    // CJS-only packages (or packages that use dynamic require()) must be
    // externalised — bundling them into the ESM output of vercel.js
    // produces `Dynamic require of "X" is not supported` at runtime.
    // The packages themselves are still bundled into the deployment by
    // Vercel as regular node_modules; they just stay as runtime imports
    // instead of being inlined into vercel.js.
    external: ['@sentry/profiling-node', 'cloudinary', 'file-type', 'image-size'],
    noExternal: [
        /@repo\/.*/,
        '@repo/config',
        '@repo/db',
        '@repo/logger',
        '@repo/schemas',
        '@repo/utils',
        '@repo/service-core',
        '@repo/seed'
    ],
    esbuildOptions(options) {
        options.resolveExtensions = ['.ts', '.js', '.json'];
    }
});
