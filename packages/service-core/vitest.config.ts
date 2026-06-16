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
                lines: 85,
                functions: 85,
                branches: 80,
                statements: 85
            },
            // Measure production source only. Without an include, vitest v8
            // instruments docs/examples, test utilities/factories, and root
            // config files at 0%, masking real src coverage (SPEC-236).
            include: ['src/**/*.ts'],
            exclude: ['node_modules/', 'dist/', '**/*.d.ts', '**/*.config.*', '**/index.ts']
        }
    }
});
