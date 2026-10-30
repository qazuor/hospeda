import { defineConfig } from 'vitest/config';

/**
 * Vitest project for @repo/payments.
 */
export default defineConfig({
    test: {
        root: import.meta.dirname,
        include: ['test/**/*.test.ts'],
        globals: true,
        environment: 'node',
        pool: 'forks',
        testTimeout: 30_000
    }
});
