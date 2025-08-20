import { getViteConfig } from 'astro/config';
import { defineConfig } from 'vitest/config';

export default defineConfig(
    getViteConfig({
        test: {
            globals: true,
            environment: 'jsdom',
            setupFiles: ['./test/setup.tsx'],
            include: [
                'test/**/*.test.ts',
                'test/**/*.test.tsx',
                'src/**/*.test.ts',
                'src/**/*.test.tsx'
            ],
            coverage: {
                provider: 'v8',
                reporter: ['text', 'json', 'html'],
                exclude: [
                    'node_modules/',
                    'dist/',
                    'test/',
                    '**/*.d.ts',
                    '**/*.config.*',
                    '.astro/',
                    'public/',
                    'scripts/'
                ]
            }
        }
    })
);
