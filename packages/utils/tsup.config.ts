import { defineConfig } from 'tsup';

export default defineConfig({
    // `validation` is also emitted standalone so browser bundles can import it
    // without pulling the barrel — see the note in `src/index.ts`.
    entry: ['src/index.ts', 'src/safe-fetch.ts', 'src/validation.ts'],
    format: ['esm'],
    dts: process.env.SKIP_PACKAGE_DTS !== 'true',
    clean: true,
    sourcemap: true,
    external: ['@repo/logger', '@repo/config']
});
