import { defineConfig } from 'tsup';

/**
 * Build configuration for `@repo/media`.
 *
 * Produces three independent bundle entries so the server-only chunk never
 * leaks into browser builds:
 *
 * - `./dist/index.{js,cjs,d.ts}` — browser-safe barrel (URL builders, presets,
 *   nanoid-based id generation, Cloudinary URL parsing).
 * - `./dist/server/index.{js,cjs,d.ts}` — Node-only barrel (Cloudinary SDK,
 *   file-magic validation, runtime environment resolution).
 * - `./dist/test-utils/index.{js,cjs,d.ts}` — placeholder for T-018.
 *
 * `cloudinary` and `image-size` are kept external so tsup never inlines the
 * Node-only SDK into any bundle — even the server one resolves them as peer
 * npm dependencies at runtime.
 */
export default defineConfig({
    entry: {
        index: 'src/index.ts',
        'server/index': 'src/server/index.ts',
        'test-utils/index': 'src/test-utils/index.ts'
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    external: ['cloudinary', 'image-size']
});
