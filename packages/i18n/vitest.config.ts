import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./test/setup.ts'],
        pool: 'forks',
        poolOptions: {
            forks: {
                maxForks: 3
            }
        },
        include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 60,
                statements: 70
            },
            exclude: [
                'node_modules/',
                'dist/',
                'test/',
                '**/*.d.ts',
                '**/*.config.*',
                'scripts/',
                'src/locales/**'
            ]
        }
    }
});
