import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        root: import.meta.dirname,
        include: ['__tests__/**/*.test.ts'],
        environment: 'node',
        testTimeout: 10_000,
        coverage: {
            include: ['*.ts'],
            exclude: ['__tests__/**', 'vitest.config.ts']
        }
    }
});
