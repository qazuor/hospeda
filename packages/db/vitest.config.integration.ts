import path from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for `packages/db` integration tests (SPEC-061).
 *
 * Distinct from the unit-test config:
 * - Runs ONLY against `test/integration/**` files (matches `*.test.ts` and
 *   `*.integration.test.ts`).
 * - Wires `globalSetup` so the ephemeral `hospeda_integration_test` database
 *   is created/dropped exactly once per run.
 * - Uses `pool: 'forks'` with `maxForks: 3` and `singleFork: false` so tests
 *   run in parallel; transaction-rollback isolation makes that safe.
 * - Bumps timeouts to absorb slower DB-bound assertions.
 *
 * Vitest version: ^3.x (poolOptions.forks API). On v4+, replace
 * `poolOptions.forks.maxForks` with top-level `maxWorkers`.
 */
export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        environment: 'node',
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: false,
                maxForks: 3
            }
        },
        include: ['test/integration/**/*.test.ts'],
        globalSetup: [path.resolve(__dirname, 'test/integration/global-setup.ts')],
        testTimeout: 30_000,
        hookTimeout: 60_000,
        teardownTimeout: 10_000
    }
});
