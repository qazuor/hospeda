import { defineConfig } from 'vitest/config';

/**
 * Vitest project for @repo/billing-verticals-contract.
 */
export default defineConfig({
    test: {
        root: import.meta.dirname,
        include: ['test/**/*.test.ts'],
        globals: true,
        environment: 'node',
        pool: 'forks',
        // The first test of a file pays the cold import of the whole
        // @repo/schemas barrel, and the never-in-production test walks the
        // repo: both can pass 5s on a loaded CI runner.
        testTimeout: 30_000
    }
});
