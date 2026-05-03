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
 * - Uses `pool: 'forks'` with `maxForks: 1`. Tests that rely on
 *   `withCleanSlate` (TRUNCATE-based) cannot share a worker pool with
 *   parallel tests because one fork's TRUNCATE wipes another fork's just-
 *   committed rows mid-test (causing FK 23503 errors). The `withTestTransaction`
 *   tests would be safe to parallelize, but mixing both styles in the same
 *   process pool requires serial execution. Wall-clock cost is small; the
 *   tests are I/O-bound rather than CPU-bound.
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
                singleFork: true,
                maxForks: 1
            }
        },
        include: ['test/integration/**/*.test.ts'],
        globalSetup: [path.resolve(__dirname, 'test/integration/global-setup.ts')],
        testTimeout: 30_000,
        hookTimeout: 60_000,
        teardownTimeout: 10_000
    }
});
