import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// SPEC-111: Astro 6 + @astrojs/react 5 bring @vitejs/plugin-react 5 transitively.
// plugin-react v5 dropped auto resolve.dedupe for react/react-dom — combined
// with React 19 + Vitest this produces "Invalid hook call" because the test
// and component end up with distinct React instances. `getViteConfig` from
// astro/config re-injects plugin-react v5 internally even with a pnpm override,
// so we bypass it entirely and build a minimal Vite config sufficient for
// component tests in jsdom. Aliases mirror astro.config.mjs.
const rootDir = resolve(__dirname, '../../');

export default defineConfig({
    plugins: [react()],
    resolve: {
        dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
        alias: {
            // Astro virtual modules: provide minimal stubs so React island
            // tests that import view-transitions helpers don't fail to resolve.
            'astro:transitions/client': resolve(
                __dirname,
                'test/stubs/astro-transitions-client.ts'
            ),
            '@': resolve(__dirname, 'src'),
            '@repo/config': resolve(rootDir, 'packages/config/src'),
            '@repo/icons': resolve(rootDir, 'packages/icons/src'),
            '@repo/utils': resolve(rootDir, 'packages/utils/src'),
            '@repo/logger': resolve(rootDir, 'packages/logger/src'),
            '@repo/i18n': resolve(rootDir, 'packages/i18n/src'),
            '@repo/schemas': resolve(rootDir, 'packages/schemas/src'),
            '@repo/service-core': resolve(rootDir, 'packages/service-core/src')
        }
    },
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            'react-dom/client',
            'react/jsx-runtime',
            'react/jsx-dev-runtime'
        ]
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./test/setup.ts'],
        pool: 'forks',
        poolOptions: {
            forks: {
                maxForks: 3
            }
        },
        testTimeout: 15000,
        css: {
            modules: {
                classNameStrategy: 'non-scoped'
            }
        },
        include: [
            'test/**/*.test.ts',
            'test/**/*.test.tsx',
            'src/**/*.test.ts',
            'src/**/*.test.tsx',
            'integrations/**/*.test.ts'
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 55,
                functions: 60,
                branches: 70,
                statements: 55
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
                '**/_functions/**',
                '**/*.astro',
                'src/layouts/',
                '**/skeletons/',
                'src/data/types.ts',
                'src/data/types-ui.ts',
                'src/lib/api/types.ts',
                'src/lib/listing-summary/summary.types.ts',
                'src/lib/api/index.ts',
                'src/lib/listing-summary/index.ts',
                'src/lib/api/endpoints.ts',
                'src/lib/api/endpoints-protected.ts',
                'src/lib/auth-client.ts',
                'src/lib/cookie-consent.ts',
                'src/lib/accommodation-card-utils.ts',
                'src/lib/icon-map.ts',
                'src/scripts/dom-helpers.ts',
                'src/data/available-features.ts'
            ]
        }
    }
});
