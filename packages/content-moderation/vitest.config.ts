import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 90,
                statements: 90
            },
            include: ['src/**/*.ts'],
            exclude: ['dist/', 'test/', 'src/**/*.d.ts', '**/*.config.*']
        }
    }
});
