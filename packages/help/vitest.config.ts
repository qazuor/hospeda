import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest project for @repo/help. The workspace packages it reads resolve from
 * source, like the API's config does, so no stale or missing `dist` leaks in.
 */
export default defineConfig({
    resolve: {
        alias: {
            '@repo/portal-routes': resolve(import.meta.dirname, '../portal-routes/src/index.ts'),
            '@repo/schemas': resolve(import.meta.dirname, '../schemas/src/index.ts')
        }
    },
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
            exclude: ['**/*.test.ts', '**/*.d.ts', 'src/index.ts', 'src/generator/cli.ts']
        }
    }
});
