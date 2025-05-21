import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    outDir: 'dist',
    target: 'node20',
    format: ['cjs'], // necesitamos commonJs por bcrypt
    splitting: false,
    sourcemap: false,
    clean: true,
    dts: false, // no necesitamos tipos en producción
    tsconfig: './tsconfig.json',
    noExternal: [/@repo\/.*/],
    external: [] // Si querés incluir absolutamente todo, dejá esto vacío
});
