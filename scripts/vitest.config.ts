import { configDefaults, defineConfig } from 'vitest/config';

/**
 * Vitest project for top-level scripts (scripts/*.ts) and their
 * companion tests under scripts/__tests__/.
 *
 * This config covers only the root scripts/__tests__/ directory. The two
 * hops CLIs (scripts/server-tools, scripts/client-tools) live outside the
 * pnpm workspace and run their own suites on bun.
 */
export default defineConfig({
    test: {
        root: import.meta.dirname,
        include: ['__tests__/**/*.test.ts'],
        // Needs a real Postgres: run by `pnpm test:cutover-db` (scripts/vitest.cutover-db.config.ts).
        exclude: [...configDefaults.exclude, '__tests__/cutover-db/**'],
        environment: 'node',
        // Many guard tests walk the real repository tree; 10s timed out on loaded CI
        // runners for three different suites (HOS-1681), so the default is 30s.
        testTimeout: 30_000
    }
});
