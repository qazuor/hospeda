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
        include: ['test/e2e/**/*.test.ts'],
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
        alias: {
            '@': resolve(__dirname, './src'),
            '@repo/schemas': resolve(__dirname, '../../packages/schemas/src'),
            '@repo/db': resolve(__dirname, '../../packages/db/src'),
            '@repo/logger': resolve(__dirname, '../../packages/logger/src'),
            '@repo/utils': resolve(__dirname, '../../packages/utils/src'),
            '@repo/config': resolve(__dirname, '../../packages/config/src'),
            '@repo/service-core': resolve(__dirname, '../../packages/service-core/src'),
            '@repo/billing': resolve(__dirname, '../../packages/billing/src'),
            '@repo/notifications': resolve(__dirname, '../../packages/notifications/src')
        }
    },
    // Don't try to bundle external dependencies - let Node.js resolve them
    ssr: {
        external: ['drizzle-orm', 'pg', 'zod']
    }
});
