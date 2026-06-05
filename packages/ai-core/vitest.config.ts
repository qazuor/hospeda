import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        extensions: ['.ts', '.js', '.mjs', '.mts', '.json']
    },
    test: {
        globals: true,
        environment: 'node',
        // Raised from default 5000ms: the barrel import (index.test.ts) triggers
        // a cold-import of @repo/db (drizzle-orm + node-postgres) which can take
        // up to ~8s on a cold fork. This mirrors the fix applied in apps/api
        // (SPEC-188 / fix/api-testtimeout-coldimport).
        testTimeout: 30000,
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
                '**/*.config.*',
                // Owner decision (2026-06-05, SPEC-173 T-042): the Vercel SDK
                // adapters are excluded from coverage because their uncovered
                // branches are real-SDK execution paths that AC-13 forbids
                // exercising in tests (no network, StubProvider only). Their
                // request/response mapping logic IS covered via mocked unit
                // tests (vercel-*.adapter.test.ts); the 90% thresholds stay
                // fully enforced for every other file in the package.
                'src/providers/vercel-openai.adapter.ts',
                'src/providers/vercel-anthropic.adapter.ts',
                // Type-only barrel — no executable code.
                'src/types/index.ts'
            ]
        }
    }
});
