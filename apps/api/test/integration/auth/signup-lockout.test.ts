/**
 * Integration tests for brute-force lockout on the sign-up endpoint.
 * Validates the composite key (email + IP) lockout behavior end-to-end.
 *
 * SPEC-026 T-017: Add lockout to signup and resend endpoints (GAP-002).
 *
 * Uses a reduced threshold (3 attempts) via in-process config override
 * for faster test execution. The real threshold is 10 attempts.
 * Requires a real database connection (run under vitest.config.e2e.ts).
 *
 * @module signup-lockout.test
 */

// Set env var BEFORE any imports so the lazy config in auth-lockout.ts picks it
// up. This affects the sign-in lockout config (email-keyed). For the signup
// handler the threshold is hardcoded in SIGNUP_LOCKOUT_CONFIG — we test the
// real value (10 attempts) to avoid coupling tests to internal constants.
process.env.HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS = '3';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearLockoutStore } from '../../../src/middlewares/auth-lockout';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';

/**
 * Maximum sign-up attempts before lockout.
 * Matches SIGNUP_LOCKOUT_CONFIG.maxAttempts in handler.ts.
 */
const SIGNUP_MAX_ATTEMPTS = 10;

/** Sign-up endpoint path (Better Auth naming convention). */
const SIGN_UP_PATH = '/api/auth/sign-up/email';

/** Shared request headers for all test requests. */
const BASE_HEADERS: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'vitest',
    // Simulate a fixed IP so lockout keys are deterministic
    'x-forwarded-for': '10.0.1.1'
};

/**
 * Helper to send a sign-up request to the app.
 *
 * @param params - The request parameters
 * @param params.app - App instance
 * @param params.email - Email to register
 * @param params.ip - Optional IP override (x-forwarded-for header)
 * @returns The fetch Response
 */
async function signUp({
    app,
    email,
    ip = '10.0.1.1'
}: {
    app: AppOpenAPI;
    email: string;
    ip?: string;
}): Promise<Response> {
    return app.request(SIGN_UP_PATH, {
        method: 'POST',
        headers: { ...BASE_HEADERS, 'x-forwarded-for': ip },
        body: JSON.stringify({
            email,
            password: 'TestPassword123!',
            name: 'Lockout Test User'
        })
    });
}

describe('Auth Sign-Up Lockout Integration', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        validateApiEnv();
        app = initApp();
    });

    afterEach(async () => {
        // Reset lockout state between tests to prevent pollution
        await clearLockoutStore();
    });

    it('should allow sign-up requests before reaching lockout threshold', async () => {
        // Arrange: use a unique email per test run to avoid conflicts with
        // Better Auth's duplicate-email error (which would still count as an attempt)
        const email = `signup-lockout-under-${Date.now()}@example.com`;
        const attemptsBeforeThreshold = SIGNUP_MAX_ATTEMPTS - 1;

        // Act & Assert: each attempt should NOT return 429
        for (let i = 0; i < attemptsBeforeThreshold; i++) {
            const res = await signUp({ app, email });

            expect(res.status, `Attempt ${i + 1} should not be 429 (got ${res.status})`).not.toBe(
                429
            );
        }
    });

    it('should return 429 after exceeding lockout threshold', async () => {
        // Arrange: exhaust all allowed attempts using the same email (which will
        // be a conflict after the first successful signup, but that still counts).
        const email = `signup-lockout-over-${Date.now()}@example.com`;

        for (let i = 0; i < SIGNUP_MAX_ATTEMPTS; i++) {
            await signUp({ app, email });
        }

        // Act: one more attempt should trigger lockout
        const lockedRes = await signUp({ app, email });

        // Assert
        expect(lockedRes.status).toBe(429);
        const body = await lockedRes.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('TOO_MANY_REQUESTS');
    });

    it('should include Retry-After header in the lockout response', async () => {
        // Arrange: trigger lockout
        const email = `signup-lockout-header-${Date.now()}@example.com`;

        for (let i = 0; i < SIGNUP_MAX_ATTEMPTS; i++) {
            await signUp({ app, email });
        }

        // Act
        const lockedRes = await signUp({ app, email });

        // Assert
        expect(lockedRes.status).toBe(429);

        const retryAfter = lockedRes.headers.get('retry-after');
        expect(retryAfter).toBeTruthy();
        expect(Number(retryAfter)).toBeGreaterThan(0);

        const body = await lockedRes.json();
        expect(body.error.retryAfter).toBeGreaterThan(0);
    });

    it('should isolate lockout by IP: same email from a different IP is not locked', async () => {
        // Arrange: lock the first IP
        const email = `signup-lockout-ip-${Date.now()}@example.com`;
        const lockedIp = '10.0.1.1';
        const otherIp = '10.0.1.2';

        for (let i = 0; i < SIGNUP_MAX_ATTEMPTS; i++) {
            await signUp({ app, email, ip: lockedIp });
        }

        // Verify the first IP is locked
        const lockedRes = await signUp({ app, email, ip: lockedIp });
        expect(lockedRes.status).toBe(429);

        // Act: same email from a different IP should NOT be locked
        const otherRes = await signUp({ app, email, ip: otherIp });

        // Assert: different IP has a fresh counter — not 429
        expect(otherRes.status, 'Different IP should not be blocked').not.toBe(429);
    });

    it('should count attempts regardless of whether the email already exists', async () => {
        // Arrange: use an email that definitely does not exist in the database.
        // After the first attempt succeeds, subsequent attempts produce a conflict
        // from Better Auth (user already exists). All attempts should still be counted.
        const email = `signup-lockout-exist-${Date.now()}@example.com`;

        // Exhaust the threshold — mix of real signup + duplicate signups
        for (let i = 0; i < SIGNUP_MAX_ATTEMPTS; i++) {
            await signUp({ app, email });
        }

        // Assert: the next attempt is blocked even though the email now exists
        const lockedRes = await signUp({ app, email });
        expect(lockedRes.status).toBe(429);
    });
});
