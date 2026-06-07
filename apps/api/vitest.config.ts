import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./test/setup.ts'],
        // Default 5s is too tight under parallel load (3 forks + concurrent monorepo
        // packages). A handful of tests cold-import and instantiate Hono apps. 15s held
        // until the suite grew (SPEC-156/165/177 + baseline-recovery); under CI load the
        // route-module-wiring tests (platform-settings-admin/public) now cold-import in
        // ~16s and intermittently tripped the 15s cap, failing shard 3. Bumped to 30s for
        // headroom; the real fix (cutting per-file cold-import cost) is tracked in SPEC-188.
        testTimeout: 30000,
        pool: 'forks',
        poolOptions: {
            forks: {
                maxForks: 3
            }
        },
        include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
        // E2E and integration tests run separately with vitest.config.e2e.ts
        exclude: ['test/e2e/**/*.test.ts', 'test/integration/**/*.test.ts', 'node_modules/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                // The api suite mocks route handlers and middleware via
                // vi.spyOn, which leaves v8 reporting fewer covered
                // functions and branches than line coverage suggests.
                // Lines and statements stay at 75% because they reflect
                // real execution; functions/branches land near the
                // observed ceiling of 60-65% on a clean run.
                lines: 75,
                functions: 60,
                branches: 60,
                statements: 75
            },
            exclude: [
                'node_modules/',
                'dist/',
                'test/',
                '**/*.d.ts',
                '**/*.config.ts',
                'src/index.ts'
            ]
        }
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            '@repo/schemas': resolve(__dirname, '../../packages/schemas/src'),
            // Subpath aliases for @repo/db must be listed before the base alias
            // so Vite matches the more specific path first.
            '@repo/db/client': resolve(__dirname, '../../packages/db/src/client.ts'),
            '@repo/db/schemas/billing': resolve(
                __dirname,
                '../../packages/db/src/schemas/billing/index.ts'
            ),
            '@repo/db/schemas': resolve(__dirname, '../../packages/db/src/schemas/index.ts'),
            '@repo/db': resolve(__dirname, '../../packages/db/src'),
            '@repo/logger': resolve(__dirname, '../../packages/logger/src'),
            '@repo/utils': resolve(__dirname, '../../packages/utils/src'),
            '@repo/config': resolve(__dirname, '../../packages/config/src'),
            '@repo/service-core': resolve(__dirname, '../../packages/service-core/src'),
            '@repo/billing': resolve(__dirname, '../../packages/billing/src'),
            '@repo/notifications': resolve(__dirname, '../../packages/notifications/src'),
            '@repo/email': resolve(__dirname, '../../packages/email/src'),
            // SPEC-187: alias content-moderation so unit tests of files in the
            // entitlement-filter chain (e.g. entitlement-filter-strip.test.ts
            // importing stripMarkdown) can resolve the transitive import in
            // service-core's message.service.ts without needing the package's
            // dist/ to be built. Mirrors the pattern used for the other
            // @repo/* packages above.
            '@repo/content-moderation': resolve(__dirname, '../../packages/content-moderation/src'),
            // Pre-existing: ai-core has the same dist-required problem; without
            // this alias, every test that transitively imports
            // `apps/api/src/utils/ai-error-mapper.ts` (e.g. platform-settings
            // routes under SPEC-156) fails to load.
            '@repo/ai-core': resolve(__dirname, '../../packages/ai-core/src'),
            // Subpath aliases for @repo/feedback must be listed before the base alias
            // so Vite matches the more specific path first.
            '@repo/feedback/schemas': resolve(
                __dirname,
                '../../packages/feedback/src/schemas/index.ts'
            ),
            '@repo/feedback': resolve(__dirname, '../../packages/feedback/src'),
            // Subpath aliases for @repo/media must be listed before the base alias
            // so Vite matches the more specific path first.
            '@repo/media/server': resolve(__dirname, '../../packages/media/src/server/index.ts'),
            '@repo/media': resolve(__dirname, '../../packages/media/src'),
            // Workaround for pnpm hoisting issue: the better-auth instance installed in
            // apps/api/node_modules does not carry @better-auth/core as a local sub-dependency.
            // Alias it explicitly to the canonical pnpm store location so Vite can resolve it.
            '@better-auth/core': resolve(
                __dirname,
                '../../node_modules/.pnpm/@better-auth+core@1.4.18_@better-auth+utils@0.3.0_@better-fetch+fetch@1.1.21_better-call@1.1._5kqvb5jwd4bes4w5eajzywfnli/node_modules/@better-auth/core'
            )
        }
    }
});
