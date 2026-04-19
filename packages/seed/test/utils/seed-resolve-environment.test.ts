import { resolveEnvironment } from '@repo/media/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * SPEC-078-GAPS T-022 — GAP-078-007.
 *
 * Verifies that the `@repo/media/server` environment resolver is importable
 * from the seed package and drives the right media folder segment for every
 * deployment context. The seed package calls this function at three sites:
 *
 * - `packages/seed/src/cli.ts`
 * - `packages/seed/src/index.ts`
 * - `packages/seed/src/utils/seedFactory.ts`
 *
 * These tests are the runtime safety net that guarantees we never fall back
 * to the old literal that was inconsistent with the Cloudinary folder layout
 * used by the API runtime.
 */
describe('seed package — resolveEnvironment integration', () => {
    const originalVercelEnv = process.env.VERCEL_ENV;
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
        process.env.VERCEL_ENV = undefined;
        // Vitest sets NODE_ENV=test; we want to drive this explicitly.
        process.env.NODE_ENV = undefined;
    });

    afterEach(() => {
        if (originalVercelEnv === undefined) {
            process.env.VERCEL_ENV = undefined;
        } else {
            process.env.VERCEL_ENV = originalVercelEnv;
        }
        if (originalNodeEnv === undefined) {
            process.env.NODE_ENV = undefined;
        } else {
            process.env.NODE_ENV = originalNodeEnv;
        }
    });

    it("returns 'dev' when neither VERCEL_ENV nor NODE_ENV is set", () => {
        expect(resolveEnvironment()).toBe('dev');
    });

    it("returns 'test' for Vitest / CI runs (NODE_ENV=test, no VERCEL_ENV)", () => {
        process.env.NODE_ENV = 'test';
        expect(resolveEnvironment()).toBe('test');
    });

    it("returns 'preview' for Vercel preview deployments", () => {
        process.env.VERCEL_ENV = 'preview';
        expect(resolveEnvironment()).toBe('preview');
    });

    it("returns 'prod' for Vercel production deployments", () => {
        process.env.VERCEL_ENV = 'production';
        expect(resolveEnvironment()).toBe('prod');
    });
});
