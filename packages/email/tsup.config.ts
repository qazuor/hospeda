import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: process.env.SKIP_PACKAGE_DTS !== 'true',
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ['react'],
    // `@repo/analytics` and `@repo/config` ship ESM only; bundling them keeps the CJS output
    // loadable (only the brand-contact constants survive tree-shaking from config).
    noExternal: ['@repo/analytics', '@repo/config']
});
