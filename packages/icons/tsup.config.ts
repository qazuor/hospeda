import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        resolver: 'src/resolver.ts'
    },
    format: ['esm', 'cjs'],
    dts: true,
    external: ['react']
});
