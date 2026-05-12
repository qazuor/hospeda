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

    describe('when HOSPEDA_DEPLOY_ENV is set', () => {
        it("should return 'prod' for HOSPEDA_DEPLOY_ENV=prod", () => {
            vi.stubEnv('HOSPEDA_DEPLOY_ENV', 'prod');
            expect(resolveEnvironment()).toBe('prod');
        });

        it("should return 'preview' for HOSPEDA_DEPLOY_ENV=preview", () => {
            vi.stubEnv('HOSPEDA_DEPLOY_ENV', 'preview');
            expect(resolveEnvironment()).toBe('preview');
        });

        it("should return 'test' for HOSPEDA_DEPLOY_ENV=test", () => {
            vi.stubEnv('HOSPEDA_DEPLOY_ENV', 'test');
            expect(resolveEnvironment()).toBe('test');
        });

        it("should return 'dev' for HOSPEDA_DEPLOY_ENV=dev", () => {
            vi.stubEnv('HOSPEDA_DEPLOY_ENV', 'dev');
            expect(resolveEnvironment()).toBe('dev');
        });

        it('should ignore HOSPEDA_DEPLOY_ENV when value is unrecognised', () => {
            vi.stubEnv('HOSPEDA_DEPLOY_ENV', 'staging-7');
            vi.stubEnv('NODE_ENV', 'production');
            expect(resolveEnvironment()).toBe('prod');
        });
    });

    describe('when HOSPEDA_DEPLOY_ENV is empty and NODE_ENV is set', () => {
        it("should return 'prod' for NODE_ENV=production", () => {
            vi.stubEnv('HOSPEDA_DEPLOY_ENV', '');
            vi.stubEnv('NODE_ENV', 'production');
            expect(resolveEnvironment()).toBe('prod');
        });

        it("should return 'test' for NODE_ENV=test", () => {
            vi.stubEnv('HOSPEDA_DEPLOY_ENV', '');
            vi.stubEnv('NODE_ENV', 'test');
            expect(resolveEnvironment()).toBe('test');
        });

        it("should return 'dev' for NODE_ENV=development", () => {
            vi.stubEnv('HOSPEDA_DEPLOY_ENV', '');
            vi.stubEnv('NODE_ENV', 'development');
            expect(resolveEnvironment()).toBe('dev');
        });
    });

    describe('when HOSPEDA_DEPLOY_ENV takes precedence over NODE_ENV', () => {
        it("should return 'preview' when HOSPEDA_DEPLOY_ENV=preview and NODE_ENV=production", () => {
            vi.stubEnv('HOSPEDA_DEPLOY_ENV', 'preview');
            vi.stubEnv('NODE_ENV', 'production');
            expect(resolveEnvironment()).toBe('preview');
        });

        it("should return 'prod' when HOSPEDA_DEPLOY_ENV=prod and NODE_ENV=development", () => {
            vi.stubEnv('HOSPEDA_DEPLOY_ENV', 'prod');
            vi.stubEnv('NODE_ENV', 'development');
            expect(resolveEnvironment()).toBe('prod');
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
    let originalDeployEnv: string | undefined;

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
        if (originalDeployEnv === undefined) {
            // biome-ignore lint/performance/noDelete: GAP-078-203 requires actual deletion semantics.
            delete process.env.HOSPEDA_DEPLOY_ENV;
        } else {
            process.env.HOSPEDA_DEPLOY_ENV = originalDeployEnv;
        }
    });

    it("should return 'dev' when NODE_ENV is deleted and HOSPEDA_DEPLOY_ENV is unset", () => {
        originalNodeEnv = process.env.NODE_ENV;
        originalDeployEnv = process.env.HOSPEDA_DEPLOY_ENV;
        // biome-ignore lint/performance/noDelete: GAP-078-203 requires actual deletion semantics.
        delete process.env.NODE_ENV;
        // biome-ignore lint/performance/noDelete: GAP-078-203 requires actual deletion semantics.
        delete process.env.HOSPEDA_DEPLOY_ENV;

        expect(resolveEnvironment()).toBe('dev');
    });
});
