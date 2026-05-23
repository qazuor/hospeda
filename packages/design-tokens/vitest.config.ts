import { defineConfig } from 'vitest/config';

/**
 * Vitest project for @repo/design-tokens.
 *
 * Tests are colocated with their source modules (e.g. src/tokens/colors.test.ts
 * lives next to src/tokens/colors.ts) — token modules are small and pure, so
 * coupling the test to its file is more discoverable than a parallel test/
 * tree.
 */
export default defineConfig({
    test: {
        root: import.meta.dirname,
        include: ['src/**/*.test.ts'],
        globals: true,
        environment: 'node',
        pool: 'forks',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.ts'],
            exclude: ['**/*.test.ts', '**/*.d.ts', 'src/generators/**', 'src/index.ts']
        }
    }
});
