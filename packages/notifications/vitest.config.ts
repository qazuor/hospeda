import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        pool: 'forks',
        poolOptions: {
            forks: {
                maxForks: 3
            }
        },
        include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 85,
                statements: 90
            },
            include: ['src/**/*.ts'],
            exclude: [
                'node_modules/',
                'dist/',
                'test/',
                '**/*.d.ts',
                '**/*.config.*',
                '**/index.ts',
                // Pure type/interface declarations — no runtime to cover.
                'src/types/delivery.types.ts',
                'src/transports/email/email-transport.interface.ts'
            ]
        }
    }
});
