import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [tsconfigPaths()],
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
            reporter: ['text', 'html', 'json-summary'],
            thresholds: {
                // The model unit tests in this package mock model methods
                // via `vi.spyOn(model, '...')`, which leaves v8 reporting
                // close to 0% function coverage despite 95%+ line coverage
                // — the mock implementations bypass the actual method
                // bodies, so v8 sees the methods as never executed.
                // The function metric is therefore not a useful signal
                // here and is intentionally omitted; the integration suite
                // (`pnpm test:integration`) exercises real method bodies.
                lines: 70,
                branches: 60,
                statements: 70
            },
            exclude: [
                '**/test/**/mocks/**',
                '**/*.d.ts',
                '**/*.config.*',
                // Example/reference files not part of the runtime package.
                'examples/',
                // CLI scripts and DB-extra appliers run through the shell,
                // not unit tests.
                'scripts/',
                // Drizzle config + script entrypoints.
                'src/migrations/**',
                'src/integration.ts',
                'src/types.ts',
                'src/schema.ts'
            ]
        },
        ui: false,
        include: ['test/**/*.test.ts'],
        exclude: [
            'node_modules',
            'dist',
            'build',
            'test/integration/**',
            // DB-introspection tests that need a live PostgreSQL connection
            // and throw in beforeAll when HOSPEDA_DATABASE_URL is missing.
            // They belong with the integration suite (`pnpm test:integration`,
            // which sets HOSPEDA_TEST_DATABASE_URL from the Docker service)
            // and not with unit-only `test:coverage` runs.
            'test/enum-consistency.test.ts',
            'test/schemas/destination-review-lifecycle.schema.test.ts'
        ]
        // setupFiles: ['src/test/setupTest.ts']
    }
});
