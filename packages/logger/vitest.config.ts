import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        extensions: ['.ts', '.js', '.mjs', '.mts', '.json']
    },
    test: {
        globals: true,
        environment: 'node',
        pool: 'forks',
        poolOptions: {
            forks: {
                maxForks: 3
            }
        },
        include: ['test/**/*.test.ts'],
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
            exclude: [
                'node_modules/',
                'dist/',
                'test/',
                'src/**/*.js',
                'src/**/*.d.ts',
                'src/**/*.d.ts.map',
                'src/**/*.js.map',
                'src/types.ts',
                'src/audit-types.ts',
                '**/*.config.*'
            ]
        }
    }
});
