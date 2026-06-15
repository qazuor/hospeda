import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./test/setup.tsx'],
        pool: 'forks',
        poolOptions: {
            forks: {
                maxForks: 3
            }
        },
        include: [
            'test/**/*.test.ts',
            'test/**/*.test.tsx',
            'src/**/*.test.ts',
            'src/**/*.test.tsx'
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 85,
                statements: 90
            },
            exclude: [
                'node_modules/',
                'dist/',
                'test/',
                '**/*.d.ts',
                '**/*.config.*',
                'scripts/',
                // Documentation example components (not production code)
                'docs/',
                // Trivial Phosphor wrappers — each file is a single
                // `createPhosphorIcon(X, 'name')` call. The factory itself
                // is fully covered by test/phosphor-props.test.tsx, so
                // adding 400+ identical render tests would be pure noise.
                'src/icons/**/*.tsx'
            ]
        }
    }
});
