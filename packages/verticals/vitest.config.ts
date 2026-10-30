import { defineConfig } from 'vitest/config';

/**
 * Vitest project for @repo/verticals: unit tests only. The database-backed
 * tests under `test/integration/` run through `vitest.integration.config.ts`.
 */
export default defineConfig({
    test: {
        root: import.meta.dirname,
        include: ['test/**/*.test.ts'],
        exclude: ['test/integration/**'],
        globals: true,
        environment: 'node',
        pool: 'forks',
        testTimeout: 30_000
    }
});
