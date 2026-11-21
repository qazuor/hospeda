import { defineConfig } from 'vitest/config';

/** Vitest project for @repo/portal-routes. */
export default defineConfig({
    test: {
        root: import.meta.dirname,
        include: ['test/**/*.test.ts'],
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
