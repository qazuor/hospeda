import { defineConfig } from 'vitest/config';

/**
 * Vitest config for the e2e package.
 *
 * The e2e suite primarily uses Playwright, not Vitest. This file overrides the
 * monorepo root config (which defines `test.projects` relative to that root).
 *
 * Static guard tests (pure-TS, no DB/servers) live in `test/unit/` and run with
 * Vitest. These ensure compile-time invariants about enum values and status codes
 * that helpers write into the DB are valid and consistent with what crons produce.
 */
export default defineConfig({
    test: {
        include: ['test/**/*.test.ts']
    }
});
