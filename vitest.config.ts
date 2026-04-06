import { defineConfig } from 'vitest/config';

/**
 * Root Vitest configuration for the Hospeda monorepo.
 *
 * Uses `test.projects` to register each app/package that has its own
 * vitest.config.ts. This allows running tests from the monorepo root
 * (e.g. `pnpm vitest run apps/admin/src/...`) while each project retains
 * its own environment, plugins, and setup files.
 *
 * Note: the deprecated `vitest.workspace.ts` API has been superseded by this
 * approach in Vitest v3+.
 */
export default defineConfig({
    test: {
        projects: [
            'apps/admin/vitest.config.ts',
            'apps/api/vitest.config.ts',
            'packages/*/vitest.config.ts',
            'scripts/cli/vitest.config.ts'
        ]
    }
});
