import { getViteConfig } from 'astro/config';
import { defineConfig } from 'vitest/config';

export default defineConfig(
    getViteConfig({
        test: {
            globals: true,
            environment: 'jsdom',
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
                    lines: 80,
                    functions: 80,
                    branches: 75,
                    statements: 80
                },
                exclude: [
                    'node_modules/',
                    'dist/',
                    'test/',
                    '**/*.d.ts',
                    '**/*.config.*',
                    '.astro/',
                    'public/',
                    '**/*.astro.mjs',
                    '**/*.mjs',
                    '**/*.js',
                    '**/chunks/**',
                    '**/pages/**',
                    '**/server/**',
                    '**/client/**',
                    '**/_astro/**',
                    '**/_functions/**'
                ]
            }
        }
    })
);
