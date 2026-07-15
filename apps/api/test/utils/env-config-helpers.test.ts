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

describe('getRateLimitConfig — protected tier (HOS-186)', () => {
    const originalEnv = { ...process.env };
    const PROTECTED_KEYS = [
        'API_RATE_LIMIT_PROTECTED_ENABLED',
        'API_RATE_LIMIT_PROTECTED_WINDOW_MS',
        'API_RATE_LIMIT_PROTECTED_MAX_REQUESTS',
        'API_RATE_LIMIT_PROTECTED_MESSAGE'
    ];

    beforeEach(() => {
        // The defaults are the contract here (prod/staging set none of these),
        // so a stray local value must not leak into the assertions below.
        for (const key of PROTECTED_KEYS) {
            Reflect.deleteProperty(process.env, key);
        }
    });

    afterEach(() => {
        for (const key of Object.keys(process.env)) {
            if (!(key in originalEnv)) {
                Reflect.deleteProperty(process.env, key);
            }
        }
        Object.assign(process.env, originalEnv);
    });

    it('defaults the protected tier to enabled', async () => {
        const { getRateLimitConfig } = await import(HELPER_PATH);
        expect(getRateLimitConfig().protectedEnabled).toBe(true);
    });

    it('defaults to a generous 2000 req / 15 min IP ceiling (owner decision)', async () => {
        const { getRateLimitConfig } = await import(HELPER_PATH);
        const config = getRateLimitConfig();

        expect(config.protectedMaxRequests).toBe(2000);
        expect(config.protectedWindowMs).toBe(900_000);
    });

    it('lets a single user spend their full per-user burst without touching the IP ceiling', async () => {
        // Regression guard for the bug this fixed: protected traffic fell into
        // the `general` catch-all (100 req / 15 min per IP), so a single user's
        // legitimate burst blew the IP bucket and the 200 req/60s per-user
        // limiter in routes/index.ts could never fire — a signed-in user had
        // LESS budget than an anonymous visitor.
        //
        // The two limits measure different things and must not be compared
        // per-minute: `prot:user` bounds a BURST (200 in any 60s), the IP bucket
        // bounds SUSTAINED volume (2000 over 15 min). What must hold is that one
        // user exhausting their whole burst stays well inside the IP ceiling —
        // it should take many distinct users bursting from one IP to trip it,
        // which is exactly the gross-abuse case it exists to catch.
        const PER_USER_BURST = 200;
        const { getRateLimitConfig } = await import(HELPER_PATH);
        const config = getRateLimitConfig();

        expect(config.protectedMaxRequests).toBeGreaterThan(PER_USER_BURST);
        // Headroom for several CGNAT-shared users bursting at once, not just one.
        expect(config.protectedMaxRequests / PER_USER_BURST).toBeGreaterThanOrEqual(5);
        expect(config.protectedMaxRequests).toBeGreaterThan(config.maxRequests);
    });

    it('honours an operator override', async () => {
        process.env.API_RATE_LIMIT_PROTECTED_MAX_REQUESTS = '5000';

        const { getRateLimitConfig } = await import(HELPER_PATH);
        expect(getRateLimitConfig().protectedMaxRequests).toBe(5000);
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
