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
            thresholds: {
                lines: 50,
                functions: 50,
                branches: 50,
                statements: 50
            },
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
        // Alias local src imports and @repo/* packages to their source directories.
        // The pnpm store may not hoist all transitive dependencies (e.g. @better-auth/core)
        // so we resolve @repo/* packages via source paths instead of built dist artifacts.
        alias: {
            '@': resolve(__dirname, './src'),
            '@repo/schemas': resolve(__dirname, '../../packages/schemas/src'),
            // Subpath aliases for @repo/db must be listed before the base alias
            // so Vite matches the more specific path first.
            '@repo/db/client': resolve(__dirname, '../../packages/db/src/client.ts'),
            '@repo/db/schemas/billing': resolve(
                __dirname,
                '../../packages/db/src/schemas/billing/index.ts'
            ),
            '@repo/db/schemas': resolve(__dirname, '../../packages/db/src/schemas/index.ts'),
            '@repo/db': resolve(__dirname, '../../packages/db/src'),
            '@repo/logger': resolve(__dirname, '../../packages/logger/src'),
            '@repo/utils': resolve(__dirname, '../../packages/utils/src'),
            '@repo/config': resolve(__dirname, '../../packages/config/src'),
            '@repo/service-core': resolve(__dirname, '../../packages/service-core/src'),
            '@repo/billing': resolve(__dirname, '../../packages/billing/src'),
            '@repo/notifications': resolve(__dirname, '../../packages/notifications/src'),
            // Workaround for pnpm hoisting issue: the better-auth instance installed in
            // apps/api/node_modules does not carry @better-auth/core as a local sub-dependency.
            // Alias it explicitly to the canonical pnpm store location so Vite can resolve it.
            '@better-auth/core': resolve(
                __dirname,
                '../../node_modules/.pnpm/@better-auth+core@1.4.18_@better-auth+utils@0.3.0_@better-fetch+fetch@1.1.21_better-call@1.1._5kqvb5jwd4bes4w5eajzywfnli/node_modules/@better-auth/core'
            )
        }
    }
});
