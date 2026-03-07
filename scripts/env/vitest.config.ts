import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['scripts/env/__tests__/**/*.test.ts'],
        root: resolve(__dirname, '../..')
    },
    resolve: {
        alias: {
            '@repo/config': resolve(__dirname, '../../packages/config/src')
        }
    }
});
