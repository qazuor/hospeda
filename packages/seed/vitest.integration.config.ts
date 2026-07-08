import path from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for `packages/seed` integration tests (HOS-25).
 *
 * Distinct from the unit-test config (`vitest.config.ts`):
 * - Runs ONLY the real-PostgreSQL data-migration tests: the
 *   `*.integration.test.ts` files under `test/data-migrations/` (migration
 *   runner, ledger, fkGuard, safeDelete, baselineStamp, billing-plans-port,
 *   lifecycle) plus everything under `test/integration/`.
 * - Wires `globalSetup` so the ephemeral `hospeda_seed_integration_test`
 *   database is created/migrated/dropped exactly once per run, and exports
 *   `HOSPEDA_DATABASE_URL` for the tests' own `new Pool(...)` bootstrap.
 * - Uses `pool: 'forks'` with `fileParallelism: false` (serial). These tests
 *   commit real rows and clean up in `afterEach`/`afterAll` (they do NOT use
 *   rollback isolation), so parallel files sharing one database would clobber
 *   each other's `seed_migrations`/`billing_plans` rows. Serial execution is
 *   required; wall-clock cost is small (I/O-bound).
 * - Bumps timeouts to absorb slower DB-bound assertions.
 *
 * The unit config excludes these same files, so nothing runs twice.
 */
export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        environment: 'node',
        pool: 'forks',
        fileParallelism: false,
        include: ['test/integration/**/*.test.ts', 'test/data-migrations/**/*.integration.test.ts'],
        globalSetup: [path.resolve(__dirname, 'test/integration/global-setup.ts')],
        testTimeout: 30_000,
        hookTimeout: 120_000,
        teardownTimeout: 10_000
    }
});
