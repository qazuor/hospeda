import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: false,
        environment: 'node',
        pool: 'forks',
        poolOptions: {
            forks: {
                maxForks: 3
            }
        },
        retry: 1,
        include: ['test/**/*.test.ts'],
        // SPEC-080 real-DB integration tests live under
        // `test/integration/services/**` and run via `pnpm test:integration`
        // (see vitest.integration.config.ts). The other files under
        // `test/integration/*.test.ts` are mocked and stay in unit.
        exclude: ['**/node_modules/**', '**/dist/**', 'test/integration/services/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 60,
                statements: 70
            },
            exclude: ['node_modules/', 'dist/']
        }
    }
});
