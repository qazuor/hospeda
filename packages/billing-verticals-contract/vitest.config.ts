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
        pool: 'forks'
    }
});
