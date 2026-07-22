import { resolve } from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for `apps/api`'s AI integration suite (HOS-247).
 *
 * Run with: `pnpm test:integration`.
 *
 * Scope is deliberately narrow: only `test/integration/ai/**` (the two files
 * that hit a real PostgreSQL database via `testDb` — `quota-enforcement.test.ts`
 * and `vault-roundtrip.test.ts` — plus `translate.test.ts`, which is fully
 * mocked but lives in the same directory). The other ~250 files under
 * `test/integration/**` already run as part of `test:e2e` (see
 * `vitest.config.e2e.ts`, whose `include` also matches `test/integration/**`);
 * widening this config's scope to duplicate that is a follow-up, not part of
 * HOS-247.
 *
 * `globalSetup` (`./test/integration/global-setup.ts`) provisions a disposable
 * `hospeda_api_integration_test` database on the CI Postgres service (or local
 * Docker Postgres) before any test file runs, and — critically — overrides
 * `process.env.HOSPEDA_DATABASE_URL` so `test-database.ts`'s `testDb` singleton
 * (used by the `beforeAll`/`afterEach`/`afterAll` hooks in the ai/** suite)
 * connects to the ephemeral DB instead of whatever `HOSPEDA_DATABASE_URL`
 * resolves to in the environment. See that file's JSDoc for the full rationale.
 *
 * Wired into CI via the `test:integration` script in `package.json` — Turborepo
 * auto-discovers any package that declares a `test:integration` script and runs
 * it as part of the `test:integration` pipeline task (`turbo.json`), which the
 * `test-integration` CI job (`.github/workflows/ci.yml`) already invokes via
 * `pnpm test:integration`. No changes to `ci.yml` or `turbo.json` were needed.
 *
 * `pool: 'forks'` + `fileParallelism: false` mirrors `vitest.config.e2e.ts`:
 * both files in scope call `testDb.clean()` (TRUNCATE ... CASCADE) between
 * tests, so running them concurrently against the same ephemeral DB would
 * corrupt each other's in-flight data.
 */
export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        environment: 'node',
        env: {
            NODE_ENV: 'test'
        },
        setupFiles: [
            './test/e2e/setup/env-setup.ts', // Load env vars FIRST
            './test/e2e/setup/test-database.ts'
        ],
        include: ['test/integration/ai/**/*.test.ts'],
        globalSetup: ['./test/integration/global-setup.ts'],
        testTimeout: 30000,
        hookTimeout: 30000,
        reporters: ['verbose'],
        // Run tests sequentially to avoid database conflicts — see the
        // "Isolation contract" note in vitest.config.e2e.ts for the full
        // rationale (both configs share the same `testDb.clean()` pattern).
        pool: 'forks',
        fileParallelism: false,
        // Vitest 4 (HOS-28): execArgv moved from poolOptions.forks to top-level.
        execArgv: ['--max-old-space-size=8192']
    },
    resolve: {
        // Alias local src imports and @repo/* packages to their source directories.
        // The pnpm store may not hoist all transitive dependencies (e.g. @better-auth/core)
        // so we resolve @repo/* packages via source paths instead of built dist artifacts.
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
            '@repo/email': resolve(__dirname, '../../packages/email/src'),
            '@repo/notifications': resolve(__dirname, '../../packages/notifications/src'),
            '@repo/ai-core': resolve(__dirname, '../../packages/ai-core/src'),
            '@repo/feedback': resolve(__dirname, '../../packages/feedback/src'),
            '@repo/content-moderation': resolve(__dirname, '../../packages/content-moderation/src'),
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
