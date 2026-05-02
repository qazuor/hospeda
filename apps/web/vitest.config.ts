import { getViteConfig } from 'astro/config';
import { defineConfig } from 'vitest/config';

export default defineConfig(
    getViteConfig({
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
            css: {
                modules: {
                    classNameStrategy: 'non-scoped'
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
                    // The web app intentionally favors integration / E2E
                    // coverage over per-component unit tests because most
                    // user-facing surfaces are Astro SSR components and
                    // React islands that require a real Astro pipeline to
                    // render. Unit thresholds stay conservative; the
                    // CI script in .github/workflows/ci.yml enforces the
                    // package-level lines floor.
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
                    // Astro components and layouts cannot be rendered by
                    // Vitest's jsdom environment (Astro requires its own
                    // SSR pipeline). They are validated through source
                    // assertions where critical, but cannot contribute to
                    // line/function coverage.
                    '**/*.astro',
                    'src/layouts/',
                    // Skeleton components are decorative-only Astro stubs.
                    '**/skeletons/',
                    // Type-only modules: no executable code to cover.
                    'src/data/types.ts',
                    'src/data/types-ui.ts',
                    'src/lib/api/types.ts',
                    'src/lib/listing-summary/summary.types.ts',
                    // Barrel re-export modules: every symbol re-exported is
                    // covered through its source file; the barrel itself
                    // never executes its own statements when consumers
                    // import directly.
                    'src/lib/api/index.ts',
                    'src/lib/listing-summary/index.ts',
                    // Thin fetch wrappers around the API. Each function is a
                    // typed call to the global `fetch` and is exercised by
                    // page-level and integration tests (which are themselves
                    // excluded under `**/pages/**`). Unit-testing them would
                    // duplicate fetch mocks already covered upstream.
                    'src/lib/api/endpoints.ts',
                    'src/lib/api/endpoints-protected.ts',
                    // Browser-side singletons that wrap external SDKs.
                    // Cannot be meaningfully unit-tested without mocking the
                    // entire underlying client; covered through page tests.
                    'src/lib/auth-client.ts',
                    'src/lib/cookie-consent.ts',
                    // Render helpers / DOM glue exercised through layout
                    // and page integration paths.
                    'src/lib/accommodation-card-utils.ts',
                    'src/lib/icon-map.ts',
                    'src/lib/tiptap-renderer.ts',
                    'src/scripts/dom-helpers.ts',
                    'src/data/available-features.ts'
                ]
            }
        }
    })
);
