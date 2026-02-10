/**
 * Vitest configuration for MercadoPago sandbox E2E tests
 *
 * Separate configuration for sandbox tests that:
 * - Have longer timeouts (network calls)
 * - Auto-retry on failures (flaky network)
 * - Run in isolation from unit tests
 * - Use test-specific environment variables
 *
 * @module test/e2e/sandbox/vitest.config.sandbox
 */

import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Test patterns
        include: ['test/e2e/sandbox/**/*.test.ts'],
        exclude: ['node_modules/**', 'dist/**'],

        // Environment
        globals: true,
        environment: 'node',

        // Setup files (use main setup for database initialization)
        setupFiles: ['./test/setup.ts'],

        // Timeouts (generous for network calls)
        testTimeout: 60000, // 60 seconds per test
        hookTimeout: 30000, // 30 seconds for before/after hooks

        // Retry on failures (network can be flaky)
        retry: 2, // Retry failed tests up to 2 times

        // Sequence (run tests sequentially to avoid rate limits)
        sequence: {
            shuffle: false, // Don't shuffle - maintain order
            concurrent: false // Run tests one at a time
        },

        // Pool options (single thread for sandbox tests)
        poolOptions: {
            threads: {
                singleThread: true // Avoid concurrent API calls
            }
        },

        // Coverage (optional for sandbox tests)
        coverage: {
            enabled: false // Sandbox tests don't affect coverage metrics
        },

        // Reporter
        reporters: ['verbose'],

        // Isolation
        isolate: true,

        // Silent console logs (too noisy with network calls)
        silent: false,

        // Log test output
        logHeapUsage: false
    },

    // Resolve aliases (same as main config)
    resolve: {
        alias: {
            '@': resolve(__dirname, '../../../src'),
            '@repo/schemas': resolve(__dirname, '../../../../../packages/schemas/src'),
            '@repo/db': resolve(__dirname, '../../../../../packages/db/src'),
            '@repo/logger': resolve(__dirname, '../../../../../packages/logger/src'),
            '@repo/utils': resolve(__dirname, '../../../../../packages/utils/src'),
            '@repo/config': resolve(__dirname, '../../../../../packages/config/src'),
            '@repo/service-core': resolve(__dirname, '../../../../../packages/service-core/src'),
            '@repo/billing': resolve(__dirname, '../../../../../packages/billing/src'),
            '@repo/notifications': resolve(__dirname, '../../../../../packages/notifications/src')
        }
    }
});
