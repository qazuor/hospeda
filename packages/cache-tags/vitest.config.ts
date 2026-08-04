import { defineConfig } from 'vitest/config';

/**
 * Vitest project for @repo/cache-tags.
 *
 * Tests are colocated with their source module — the package is one small pure
 * module, so a parallel test/ tree would be more indirection than structure.
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
            exclude: ['**/*.test.ts', '**/*.d.ts', 'src/index.ts']
        }
    }
});
