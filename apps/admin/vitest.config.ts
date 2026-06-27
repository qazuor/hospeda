import path from 'node:path';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    resolve: {
        // Map @repo/billing to its TypeScript source so vitest can resolve it
        // without requiring a dist/ build in the worktree. This mirrors the
        // tsconfig path alias approach used by other @repo/* packages.
        alias: {
            '@repo/billing': path.resolve(__dirname, '../../packages/billing/src/index.ts')
        }
    },
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
                // Most admin surfaces are TanStack Router route files
                // and entity create/edit/view pages exercised through E2E
                // and integration. The unit suite focuses on entity-list
                // filters, tag management, hooks, and shared components,
                // so the realistic floor is well below 70%.
                lines: 50,
                functions: 30,
                branches: 55,
                statements: 50
            },
            exclude: [
                'node_modules/',
                'dist/',
                'test/',
                '**/*.d.ts',
                '**/*.config.*',
                'src/routeTree.gen.ts',
                '.output/',
                '.tanstack/',
                'public/',
                // Build artifacts and bundled chunks: never source files
                // even when sourcemaps point back into src.
                '**/.output/**',
                '**/chunks/**',
                '**/_functions/**',
                '**/static/assets/**',
                'client-dist/',
                // TanStack Router route files: thin route definitions
                // that mostly delegate to entity-page components.
                'src/routes/**'
            ]
        }
    }
});
