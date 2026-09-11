import { defineConfig } from 'vitest/config';

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
        environment: 'node',
        testTimeout: 10_000
    }
});
