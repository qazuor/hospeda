import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@repo/db': resolve(__dirname, '../db/src/index.ts'),
            '@repo/schemas': resolve(__dirname, '../schemas/src/index.ts')
        }
    },
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
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
            exclude: ['dist/', 'test/', 'src/**/*.d.ts', '**/*.config.*']
        }
    }
});
