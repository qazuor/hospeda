import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    outDir: 'dist',
    target: 'node20',
    format: ['cjs'], // necesitamos commonJs por bcrypt
    splitting: false,
    sourcemap: false,
    clean: true,
    dts: false, // we do not need types in production
    tsconfig: './tsconfig.json',
    noExternal: [/@repo\/.*/],
    external: [] // If you want to include absolutely everything, leave this empty
});
