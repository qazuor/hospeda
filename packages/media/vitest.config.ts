import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for `@repo/media`.
 *
 * SPEC-078-GAPS GAP-078-098: per-file coverage thresholds are enabled so
 * that no individual source file can quietly drop below the bar without
 * failing CI. Barrel re-export files (`index.ts`) and pure type-only files
 * (`types.ts`) are excluded because they are evaluated only at import time
 * and are not exercised by unit tests.
 *
 * Threshold rationale: the spec requested 90/85/90/90 with `perFile: true`.
 * The current source files (cloudinary.provider, validate-media-file,
 * extract-public-id, mock-provider) sit between 90 and 100 % once the
 * barrel files are excluded, so 90/85/90/90 is achievable today without
 * relaxation. Branch threshold is intentionally lower than the others
 * (85) because v8 over-counts branches for short-circuited boolean
 * expressions, particularly in the magic-byte detector.
 */
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
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                perFile: true,
                lines: 90,
                functions: 90,
                branches: 85,
                statements: 90
            },
            include: ['src/**/*.ts'],
            exclude: [
                'node_modules/',
                'dist/',
                'src/**/*.test.ts',
                'src/**/__tests__/**',
                'src/**/*.d.ts',
                '**/*.config.*',
                // GAP-078-098: barrel re-export files have no behavior to test;
                // including them would force every barrel to be hit by a test
                // that imports from the deep path, which conflicts with the
                // package's public API design.
                'src/**/index.ts',
                // Pure type definitions — no executable code.
                'src/server/types.ts',
                // Test helpers exposed via `@repo/media/test-utils` are not
                // production code; consumers exercise the relevant branches
                // indirectly. Direct branch coverage of mock helpers would
                // be artificial and would tie this config to internals of
                // tests in other packages.
                'src/test-utils/**'
            ]
        }
    }
});
