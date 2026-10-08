import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for the @repo/verticals integration tests: a real
 * PostgreSQL built with `db:migrate` (and the extras carril) by
 * `test/integration/global-setup.ts`, in its own ephemeral database so it runs
 * in parallel with the other packages' integration suites under turbo.
 */
export default defineConfig({
    test: {
        root: import.meta.dirname,
        globals: true,
        environment: 'node',
        pool: 'forks',
        fileParallelism: false,
        include: ['test/integration/**/*.test.ts'],
        globalSetup: [path.resolve(import.meta.dirname, 'test/integration/global-setup.ts')],
        testTimeout: 30_000,
        hookTimeout: 120_000,
        teardownTimeout: 10_000
    }
});
