import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        root: import.meta.dirname,
        include: ['__tests__/**/*.test.ts'],
        environment: 'node',
        testTimeout: 10_000,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 60,
                statements: 70
            },
            include: ['*.ts'],
            exclude: ['__tests__/**', 'vitest.config.ts']
        }
    }
});
