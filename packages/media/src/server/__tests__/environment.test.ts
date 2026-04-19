import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveEnvironment } from '../environment.js';

/**
 * SPEC-078-GAPS GAP-078-091, GAP-078-202, GAP-078-203.
 *
 * Environment-resolution tests must be hermetically isolated. The original
 * suite mutated `process.env` directly and reset values to the literal string
 * `'undefined'` in `afterEach`, which leaked between cases and could mask
 * regressions when run in parallel with other env-sensitive code paths.
 *
 * This rewrite uses Vitest's `vi.stubEnv` API for setting overrides and
 * `vi.unstubAllEnvs()` in `afterEach` so the underlying `process.env` is
 * fully restored between cases. A separate suite at the bottom covers the
 * `delete process.env.NODE_ENV` path, which `vi.stubEnv` cannot express, by
 * snapshotting and manually restoring the original values.
 */
describe('resolveEnvironment', () => {
    afterEach(() => {
        // Hermetic teardown: any env stubbed via vi.stubEnv is rolled back
        // here so process.env returns to the state it was in before each test.
        vi.unstubAllEnvs();
    });

    describe('when VERCEL_ENV=production', () => {
        it("should return 'prod'", () => {
            // Arrange
            vi.stubEnv('VERCEL_ENV', 'production');

            // Act
            const result = resolveEnvironment();

            // Assert
            expect(result).toBe('prod');
        });
    });

    describe('when VERCEL_ENV=preview', () => {
        it("should return 'preview'", () => {
            // Arrange
            vi.stubEnv('VERCEL_ENV', 'preview');

            // Act
            const result = resolveEnvironment();

            // Assert
            expect(result).toBe('preview');
        });
    });

    describe('when NODE_ENV=test and VERCEL_ENV is empty', () => {
        it("should return 'test'", () => {
            // Arrange — explicit empty string for VERCEL_ENV (not 'production'/'preview'),
            // and NODE_ENV='test'. vi.stubEnv with empty string yields '' rather than
            // undefined, which the resolver treats as "not production / not preview".
            vi.stubEnv('VERCEL_ENV', '');
            vi.stubEnv('NODE_ENV', 'test');

            // Act
            const result = resolveEnvironment();

            // Assert
            expect(result).toBe('test');
        });
    });

    describe('when neither VERCEL_ENV nor NODE_ENV indicate a known environment', () => {
        it("should return 'dev'", () => {
            // Arrange
            vi.stubEnv('VERCEL_ENV', '');
            vi.stubEnv('NODE_ENV', 'development');

            // Act
            const result = resolveEnvironment();

            // Assert
            expect(result).toBe('dev');
        });
    });

    describe('when VERCEL_ENV takes precedence over NODE_ENV', () => {
        it("should return 'prod' when VERCEL_ENV=production and NODE_ENV=test", () => {
            // Arrange
            vi.stubEnv('VERCEL_ENV', 'production');
            vi.stubEnv('NODE_ENV', 'test');

            // Act
            const result = resolveEnvironment();

            // Assert
            expect(result).toBe('prod');
        });

        it("should return 'preview' when VERCEL_ENV=preview and NODE_ENV=test", () => {
            // Arrange
            vi.stubEnv('VERCEL_ENV', 'preview');
            vi.stubEnv('NODE_ENV', 'test');

            // Act
            const result = resolveEnvironment();

            // Assert
            expect(result).toBe('preview');
        });
    });
});

/**
 * Separate suite for the case where NODE_ENV is genuinely deleted from
 * process.env (vi.stubEnv cannot delete a key, only set it). We snapshot
 * the original values before the suite runs and restore them after, so the
 * outer test runner is not affected.
 *
 * SPEC-078-GAPS GAP-078-203.
 */
describe('resolveEnvironment when NODE_ENV is deleted from process.env', () => {
    let originalNodeEnv: string | undefined;
    let originalVercelEnv: string | undefined;

    afterEach(() => {
        // Manually restore both keys to their pre-test values. The `delete`
        // operator is intentional here (GAP-078-203): we are validating the
        // resolver under genuine env-key-absence semantics, which assignment
        // to `undefined` does NOT reproduce (`'X' in process.env` would
        // remain true after `process.env.X = undefined`).
        if (originalNodeEnv === undefined) {
            // biome-ignore lint/performance/noDelete: GAP-078-203 requires actual deletion semantics.
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = originalNodeEnv;
        }
        if (originalVercelEnv === undefined) {
            // biome-ignore lint/performance/noDelete: GAP-078-203 requires actual deletion semantics.
            delete process.env.VERCEL_ENV;
        } else {
            process.env.VERCEL_ENV = originalVercelEnv;
        }
    });

    it("should return 'dev' when NODE_ENV is deleted and VERCEL_ENV is unset", () => {
        // Arrange
        originalNodeEnv = process.env.NODE_ENV;
        originalVercelEnv = process.env.VERCEL_ENV;
        // biome-ignore lint/performance/noDelete: GAP-078-203 requires actual deletion semantics.
        delete process.env.NODE_ENV;
        // biome-ignore lint/performance/noDelete: GAP-078-203 requires actual deletion semantics.
        delete process.env.VERCEL_ENV;

        // Act
        const result = resolveEnvironment();

        // Assert
        expect(result).toBe('dev');
    });
});
