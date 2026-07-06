import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        pool: 'forks',
        maxWorkers: 3,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 60,
                statements: 70
            },
            exclude: ['node_modules/', 'dist/', '**/*.d.ts', '**/*.config.*']
        }
    }
});
