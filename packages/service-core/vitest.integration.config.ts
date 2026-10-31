import path from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for `packages/service-core` integration tests
 * (SPEC-080).
 *
 * - Picks up real-DB tests under `test/integration/services/**` only — the
 *   existing files at `test/integration/*.test.ts` are mocked and stay in
 *   the unit suite.
 * - Provisions its own ephemeral PostgreSQL database
 *   (`hospeda_service_integration_test`) so the suite is independent of
 *   `packages/db`'s SPEC-061 run, which would otherwise drop its DB and
 *   leave nothing for service-core to connect to.
 * - Declares which sources `--coverage` measures (HOS-1960). Coverage is OFF by
 *   default and only turned on by `test:integration:coverage`, which CI runs on
 *   PRs to `main`: the real-DB suite is what exercises most of
 *   `services/billing/**`, and the unit run alone measures it at ~72%.
 * - Uses `pool: 'forks'` with `maxWorkers: 3` so tests run in parallel; each
 *   test wraps its body in a rollback-isolated transaction. (Vitest 4 / HOS-28:
 *   the old `poolOptions.forks.maxForks` is now top-level `maxWorkers`, and the
 *   default `singleFork: false` no longer needs to be stated.)
 */
export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: false,
        environment: 'node',
        pool: 'forks',
        maxWorkers: 3,
        include: ['test/integration/services/**/*.test.ts'],
        globalSetup: [path.resolve(__dirname, 'test/integration/services/global-setup.ts')],
        testTimeout: 30_000,
        hookTimeout: 60_000,
        teardownTimeout: 10_000,
        coverage: {
            provider: 'v8',
            // `json` only: the merged gate (scripts/ci/merge-coverage.mjs) reads
            // coverage-final.json and regenerates the summary itself.
            reporter: ['json'],
            // Same source set and exclusions as vitest.config.ts so both runs
            // describe identical statement maps and merge hit-for-hit.
            include: ['src/**/*.ts'],
            exclude: ['**/dist/**', '**/*.d.ts', '**/*.config.*', '**/index.ts']
        }
    }
});
