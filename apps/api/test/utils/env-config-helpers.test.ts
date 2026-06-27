/**
 * @file env-config-helpers.test.ts
 * @description Unit tests for the getCorsConfig() helper in env-config-helpers.ts.
 *
 * SPEC-203: Verifies that X-Idempotency-Key is always present in the resolved
 * CORS allowHeaders, even when the env override omits it (FIX 1).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// We import after mutating process.env so each test gets a fresh evaluation.
// Re-import via dynamic import to bypass module cache between env mutations.

const HELPER_PATH = '../../src/utils/env-config-helpers';

describe('getCorsConfig — allowHeaders always includes X-Idempotency-Key', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Clean up any leftover override between tests
        Reflect.deleteProperty(process.env, 'API_CORS_ALLOW_HEADERS');
    });

    afterEach(() => {
        // Restore original env state
        for (const key of Object.keys(process.env)) {
            if (!(key in originalEnv)) {
                Reflect.deleteProperty(process.env, key);
            }
        }
        Object.assign(process.env, originalEnv);
    });

    it('includes X-Idempotency-Key when env override omits it', async () => {
        process.env.API_CORS_ALLOW_HEADERS = 'Content-Type,Authorization';

        // Dynamic import bypasses module-level cache so process.env changes take effect.
        const { getCorsConfig } = await import(HELPER_PATH);
        const config = getCorsConfig();

        const headers = config.allowHeaders as string[];
        const hasIdempotencyKey = headers.some(
            (h: string) => h.toLowerCase() === 'x-idempotency-key'
        );
        expect(hasIdempotencyKey).toBe(true);
    });

    it('does not add a duplicate X-Idempotency-Key when already present', async () => {
        process.env.API_CORS_ALLOW_HEADERS = 'Content-Type,X-Idempotency-Key,Authorization';

        const { getCorsConfig } = await import(HELPER_PATH);
        const config = getCorsConfig();

        const headers = config.allowHeaders as string[];
        const count = headers.filter((h: string) => h.toLowerCase() === 'x-idempotency-key').length;
        expect(count).toBe(1);
    });

    it('does not add a duplicate when already present in different case', async () => {
        process.env.API_CORS_ALLOW_HEADERS = 'Content-Type,x-idempotency-key';

        const { getCorsConfig } = await import(HELPER_PATH);
        const config = getCorsConfig();

        const headers = config.allowHeaders as string[];
        const count = headers.filter((h: string) => h.toLowerCase() === 'x-idempotency-key').length;
        expect(count).toBe(1);
    });

    it('includes X-Idempotency-Key with the default (no env override)', async () => {
        // No API_CORS_ALLOW_HEADERS set — uses the hardcoded default
        const { getCorsConfig } = await import(HELPER_PATH);
        const config = getCorsConfig();

        const headers = config.allowHeaders as string[];
        const hasIdempotencyKey = headers.some(
            (h: string) => h.toLowerCase() === 'x-idempotency-key'
        );
        expect(hasIdempotencyKey).toBe(true);
    });
});

describe('parseCommaSeparated', () => {
    it('returns an empty array for undefined input', async () => {
        const { parseCommaSeparated } = await import(HELPER_PATH);
        expect(parseCommaSeparated(undefined)).toEqual([]);
    });

    it('splits and trims a comma-separated string', async () => {
        const { parseCommaSeparated } = await import(HELPER_PATH);
        expect(parseCommaSeparated('a, b , c')).toEqual(['a', 'b', 'c']);
    });
});
