import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['scripts/env/__tests__/**/*.test.ts'],
        root: resolve(__dirname, '../..'),
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 60,
                statements: 70
            },
            include: ['scripts/env/**/*.ts'],
            exclude: ['scripts/env/__tests__/**', 'scripts/env/vitest.config.ts', '**/*.d.ts']
        }
    },
    resolve: {
        alias: {
            '@repo/config': resolve(__dirname, '../../packages/config/src')
        }
    }
});
