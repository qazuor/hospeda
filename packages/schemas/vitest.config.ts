import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@repo/feedback/schemas': path.resolve(__dirname, '../feedback/src/schemas/index.ts')
        }
    },
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
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 90,
                functions: 70,
                branches: 85,
                statements: 90
            },
            exclude: [
                'node_modules/',
                'dist/',
                'test/',
                '**/*.d.ts',
                '**/*.config.*',
                '**/index.ts', // Re-export files
                // Documentation-only example code (imports libs not in deps;
                // never exported or imported by production schemas).
                'docs/',
                // Copy-paste scaffolding template for devs — not imported anywhere.
                'src/templates/'
            ]
        }
    }
});
