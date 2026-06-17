import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for the Hospeda mobile app.
 *
 * Note: component tests for React Native require `@testing-library/react-native`
 * and a custom RN environment — that is T-013 scope. For now, only
 * logic/unit tests are supported (environment: node).
 *
 * The `test` script uses `--passWithNoTests` so Turbo `test` pipeline
 * does not fail when the test suite is empty (AC-F1.1 requirement).
 */
export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./test/setup.ts'],
        include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'dist/', '.expo/', '**/*.d.ts', '**/*.config.*']
        }
    }
});
