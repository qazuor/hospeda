import { defineConfig } from 'vitest/config';

/**
 * Vitest project for the cutover script's database tests (U3, HOS-1426).
 *
 * Kept apart from `vitest.config.ts` because these tests need a real Postgres
 * (`HOSPEDA_TEST_DATABASE_URL`, the same server the integration job uses) and must
 * FAIL, not skip, when it is missing. They create and drop their own scratch databases.
 */
export default defineConfig({
    test: {
        root: import.meta.dirname,
        include: ['__tests__/cutover-db/**/*.test.ts'],
        environment: 'node',
        fileParallelism: false,
        testTimeout: 60_000,
        hookTimeout: 180_000
    }
});
