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
 * - Uses `pool: 'forks'` with `maxForks: 3` and `singleFork: false` so
 *   tests run in parallel; each test wraps its body in a rollback-isolated
 *   transaction.
 */
export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: false,
        environment: 'node',
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: false,
                maxForks: 3
            }
        },
        include: ['test/integration/services/**/*.test.ts'],
        globalSetup: [path.resolve(__dirname, 'test/integration/services/global-setup.ts')],
        testTimeout: 30_000,
        hookTimeout: 60_000,
        teardownTimeout: 10_000
    }
});
