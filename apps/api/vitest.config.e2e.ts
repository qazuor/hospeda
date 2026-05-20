import { resolve } from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for E2E tests
 *
 * Run with: `pnpm test:e2e` (local) or `pnpm test:e2e:ci` (with JSON report + budget check).
 *
 * Environment variables are loaded by src/utils/env.ts which automatically loads
 * .env.test when NODE_ENV=test. The test-database setup file (loaded second by
 * `setupFiles` order — order is load-bearing) opens the singleton Postgres pool
 * and verifies schema presence via `assertSchemaReady`.
 *
 * ## Isolation contract (SPEC-143 T-143-56)
 *
 * The suite runs in a SINGLE forked process (`singleFork: true`) and test files
 * execute SEQUENTIALLY. This is intentional and currently mandatory because 48
 * of the 50 e2e test files perform `testDb.clean()` (TRUNCATE * CASCADE on the
 * public schema) between tests. Running two files concurrently against the same
 * database would mean one file's clean() wipes another file's in-flight data.
 *
 * The only way to safely parallelize this suite without first migrating every
 * file off `clean()` to `withRollback()` (a 26-file refactor) is schema-per-fork
 * — each parallel worker gets its own Postgres schema, its own Drizzle push,
 * and its own apply-postgres-extras run. That is a future SPEC follow-up; see
 * `apps/api/test/e2e/README.md` "Path to parallelism".
 *
 * Until then, do NOT flip singleFork to false. The T-143-65 fix
 * (resetDb + assertSchemaReady) made cross-FILE setup/teardown safe, but
 * cross-fork concurrent writes against a shared DB are still broken by the
 * clean() pattern.
 *
 * ## Timeouts
 *
 * `testTimeout: 30000` absorbs CI jitter; the slowest realistic billing flow
 * (subscription activation + entitlement load) sits around 4-8 seconds.
 * `hookTimeout: 30000` covers the longest beforeAll seeding chains.
 * `slowTestThreshold: 5000` flags any single test that takes >5s so we can
 * see drift early. Surfaces in the verbose reporter as a yellow marker.
 *
 * ## CI report
 *
 * When `VITEST_E2E_JSON_OUTPUT` is set, vitest also emits a JSON report at that
 * path. `scripts/check-e2e-budget.mjs` parses it and fails the run if the total
 * wallclock exceeds `E2E_BUDGET_SECONDS` (default 1800 = 30 min) or any single
 * file exceeds `E2E_FILE_BUDGET_SECONDS` (default 300 = 5 min). The reporter
 * union (`verbose` + `json`) is wired by `pnpm test:e2e:ci` in package.json so
 * local runs stay simple.
 */
const jsonOutputPath = process.env.VITEST_E2E_JSON_OUTPUT;

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
        include: ['test/e2e/**/*.test.ts', 'test/integration/**/*.test.ts'],
        // E2E tests can be slower, increase timeout
        testTimeout: 30000,
        hookTimeout: 30000,
        // Flag any single test that takes >5s in the verbose reporter.
        // Drift past this almost always means an unintended network call or
        // a stuck DB query — investigate, do not just bump the threshold.
        slowTestThreshold: 5000,
        // Reporters: verbose for humans; json appended when CI exports the path.
        reporters: jsonOutputPath ? ['verbose', 'json'] : ['verbose'],
        ...(jsonOutputPath ? { outputFile: jsonOutputPath } : {}),
        // Run tests sequentially to avoid database conflicts.
        // See the "Isolation contract" section in the file header.
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true
            }
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 50,
                functions: 50,
                branches: 50,
                statements: 50
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
