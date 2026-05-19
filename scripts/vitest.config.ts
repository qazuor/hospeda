import { defineConfig } from 'vitest/config';

/**
 * Vitest project for top-level scripts (scripts/*.ts) and their
 * companion tests under scripts/__tests__/.
 *
 * Tests under scripts/cli/__tests__/ are owned by scripts/cli/vitest.config.ts
 * — this config covers only the root scripts/__tests__/ directory.
 */
export default defineConfig({
    test: {
        root: import.meta.dirname,
        include: ['__tests__/**/*.test.ts'],
        environment: 'node',
        testTimeout: 10_000
    }
});
