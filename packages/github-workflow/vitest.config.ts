import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/**/*.ts'],
            exclude: [
                '**/test/**',
                '**/node_modules/**',
                '**/dist/**',
                '**/*.d.ts',
                '**/index.ts',
                '*.config.ts'
            ],
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 90,
                statements: 90
            }
        },
        ui: false,
        include: ['test/**/*.test.ts'],
        exclude: ['node_modules', 'dist', 'build']
    }
});
