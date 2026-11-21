import { resolve } from 'node:path';
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
    resolve: {
        alias: {
            // Reached through packages/help/src (HOS-2410): resolve from source,
            // like the root tsconfig `paths` do for tsx, so no build is needed.
            '@repo/portal-routes': resolve(
                import.meta.dirname,
                '../packages/portal-routes/src/index.ts'
            )
        }
    },
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
