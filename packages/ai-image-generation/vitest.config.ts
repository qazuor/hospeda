import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'dist/',
                'test/',
                'examples/',
                'scripts/',
                '**/*.test.ts',
                '**/*.spec.ts',
                '**/index.ts',
                'vitest.config.ts',
                '*.config.ts'
            ],
            thresholds: {
                lines: 80,
                functions: 90,
                branches: 75,
                statements: 80
            }
        }
    }
});
