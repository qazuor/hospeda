import { defineConfig } from 'vitest/config';

/**
 * Minimal Vitest config for the e2e package.
 *
 * The e2e suite uses Playwright, not Vitest. This file exists only to prevent
 * Vitest from inheriting the monorepo root config (which defines `test.projects`
 * with paths relative to that root) when running `vitest run --passWithNoTests`
 * from this directory.
 */
export default defineConfig({
    test: {
        include: []
    }
});
