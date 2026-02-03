import { resolve } from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for E2E tests
 * Run E2E tests separately with: pnpm test:e2e
 *
 * Note: Environment variables are loaded by src/utils/env.ts
 * which automatically loads .env.test when NODE_ENV=test
 */
export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        environment: 'node',
        env: {
            NODE_ENV: 'test'
        },
        setupFiles: [
            './test/e2e/setup/env-setup.ts', // Load env vars FIRST
            './test/e2e/setup/test-database.ts'
        ],
        include: ['test/e2e/**/*.test.ts', 'test/integration/**/*.test.ts'],
        // E2E tests can be slower, increase timeout
        testTimeout: 30000,
        hookTimeout: 30000,
        // Run tests sequentially to avoid database conflicts
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true
            }
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'dist/',
                'test/',
                '**/*.d.ts',
                '**/*.config.ts',
                'src/index.ts'
            ]
        }
    },
    resolve: {
        // Only alias local src imports - let Node resolve @repo/* packages via package.json exports
        alias: {
            '@': resolve(__dirname, './src')
        }
    }
});
