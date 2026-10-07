import { defineConfig } from 'vitest/config';

/**
 * Vitest project for @repo/test-clock.
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
