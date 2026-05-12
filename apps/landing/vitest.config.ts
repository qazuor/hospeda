import { defineConfig } from 'vitest/config';

/**
 * Vitest config for the pre-launch landing page (`apps/landing`).
 *
 * The landing is a static Astro coming-soon page with no logic worth
 * unit-testing today; `pnpm test --passWithNoTests` is the contract.
 * A dedicated standalone config is required so the binary does NOT
 * inherit the root `vitest.config.ts`, whose `test.projects` paths are
 * relative to the monorepo root and break when resolved from
 * `apps/landing/` (it would look for `apps/landing/apps/admin/vitest.config.ts`).
 */
export default defineConfig({
    test: {
        passWithNoTests: true,
        include: ['test/**/*.test.{ts,tsx}']
    }
});
