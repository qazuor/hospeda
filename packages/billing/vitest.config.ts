import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@repo/config': path.resolve(__dirname, '../config/src/index.ts'),
            '@repo/logger': path.resolve(__dirname, '../logger/src/index.ts')
        }
    },
    test: {
        globals: true,
        environment: 'node',
        pool: 'forks',
        poolOptions: {
            forks: {
                maxForks: 3
            }
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 90,
                statements: 90
            },
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/index.ts']
        }
    }
});
