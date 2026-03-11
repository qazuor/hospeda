/**
 * Integration tests for brute-force lockout on the forgot-password endpoint.
 * Validates the composite key (email + IP) lockout behavior end-to-end.
 *
 * SPEC-026 T-016: Add lockout to forgot-password endpoint (GAP-002).
 *
 * Uses a reduced threshold (3 attempts) for faster test execution.
 * Requires a real database connection (run under vitest.config.e2e.ts).
 *
 * @module forgot-password-lockout.test
 */

// Set lockout threshold BEFORE any imports so the lazy config picks it up.
// (This env var is only consumed by the sign-in lockout; forgot-password uses
// a fixed config of 5 attempts. We keep it set anyway to avoid side effects
// from other tests that share the same process.)
process.env.HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS = '3';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearLockoutStore } from '../../../src/middlewares/auth-lockout';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';

/**
 * Maximum forgot-password attempts before lockout.
 * Matches FORGOT_PASSWORD_LOCKOUT_CONFIG.maxAttempts in handler.ts.
 */
const MAX_ATTEMPTS = 5;

/** Forgot-password endpoint path (Better Auth naming convention). */
const FORGOT_PASSWORD_PATH = '/api/auth/forget-password';

/** Shared request headers for all test requests. */
const BASE_HEADERS: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'vitest',
    // Simulate a fixed IP so rate-limit keys are deterministic
    'x-forwarded-for': '10.0.0.1'
};

/** Test email — does not need to exist in the database. */
const TEST_EMAIL = `forgot-lockout-test-${Date.now()}@example.com`;

/**
 * Helper to send a forgot-password request to the app.
 *
 * @param params - The request parameters
 * @param params.app - App instance
 * @param params.email - Email to request a password reset for
 * @param params.ip - Optional IP override (x-forwarded-for header)
 * @returns The fetch Response
 */
async function forgotPassword({
    app,
    email,
    ip = '10.0.0.1'
}: {
    app: AppOpenAPI;
    email: string;
    ip?: string;
}): Promise<Response> {
    return app.request(FORGOT_PASSWORD_PATH, {
        method: 'POST',
        headers: { ...BASE_HEADERS, 'x-forwarded-for': ip },
        body: JSON.stringify({ email })
    });
}

describe('Auth Forgot-Password Lockout Integration', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        validateApiEnv();
        app = initApp();
    });

    afterEach(async () => {
        // Reset lockout state between tests to prevent pollution
        await clearLockoutStore();
    });

    it('should allow requests before reaching lockout threshold', async () => {
        // Arrange: attempt fewer than MAX_ATTEMPTS requests
        const attemptsBeforeThreshold = MAX_ATTEMPTS - 1;

        // Act & Assert: each attempt should NOT return 429
        for (let i = 0; i < attemptsBeforeThreshold; i++) {
            const res = await forgotPassword({ app, email: TEST_EMAIL });

            expect(res.status, `Attempt ${i + 1} should not be 429 (got ${res.status})`).not.toBe(
                429
            );
        }
    });

    it('should return 429 after exceeding lockout threshold', async () => {
        // Arrange: exhaust all allowed attempts
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await forgotPassword({ app, email: TEST_EMAIL });
        }

        // Act: one more attempt should trigger lockout
        const lockedRes = await forgotPassword({ app, email: TEST_EMAIL });

        // Assert
        expect(lockedRes.status).toBe(429);
        const body = await lockedRes.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('TOO_MANY_REQUESTS');
    });

    it('should include Retry-After header in the lockout response', async () => {
        // Arrange: trigger lockout
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await forgotPassword({ app, email: TEST_EMAIL });
        }

        // Act
        const lockedRes = await forgotPassword({ app, email: TEST_EMAIL });

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
        const lockedIp = '10.0.0.1';
        const otherIp = '10.0.0.2';

        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await forgotPassword({ app, email: TEST_EMAIL, ip: lockedIp });
        }

        // Verify the first IP is locked
        const lockedRes = await forgotPassword({ app, email: TEST_EMAIL, ip: lockedIp });
        expect(lockedRes.status).toBe(429);

        // Act: same email from a different IP should NOT be locked
        const otherRes = await forgotPassword({ app, email: TEST_EMAIL, ip: otherIp });

        // Assert: different IP has a fresh counter and should not be 429
        expect(otherRes.status, 'Different IP should not be blocked').not.toBe(429);
    });

    it('should lock out even when the email does not exist in the database', async () => {
        // Better Auth returns 200 regardless of whether the email exists
        // (to prevent enumeration). We still count each attempt.
        const nonExistentEmail = `nonexistent-${Date.now()}@example.com`;

        // Exhaust the threshold
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await forgotPassword({ app, email: nonExistentEmail });
        }

        // Assert: next attempt is blocked even though the email is unknown
        const lockedRes = await forgotPassword({ app, email: nonExistentEmail });
        expect(lockedRes.status).toBe(429);
    });
});
