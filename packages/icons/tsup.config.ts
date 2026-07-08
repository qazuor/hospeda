import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        resolver: 'src/resolver.ts'
    },
    format: ['esm', 'cjs'],
    dts: process.env.SKIP_PACKAGE_DTS !== 'true',
    external: ['react']
});
