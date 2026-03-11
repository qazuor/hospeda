/**
 * Integration tests for brute-force lockout on the send-verification-email endpoint.
 * Validates the composite key (email + IP) lockout behavior end-to-end.
 *
 * SPEC-026 T-017: Add lockout to signup and resend endpoints (GAP-002).
 *
 * The threshold is hardcoded in RESEND_VERIFICATION_LOCKOUT_CONFIG (5 attempts).
 * Tests use the real value to keep the test behavior aligned with production.
 * Requires a real database connection (run under vitest.config.e2e.ts).
 *
 * @module resend-verification-lockout.test
 */

// Set env var BEFORE any imports so the lazy config in auth-lockout.ts picks it
// up. This only affects the email-keyed sign-in lockout, not the resend handler
// (which has its own hardcoded config), but setting it avoids side effects
// from other tests sharing the same process.
process.env.HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS = '3';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearLockoutStore } from '../../../src/middlewares/auth-lockout';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';

/**
 * Maximum resend-verification attempts before lockout.
 * Matches RESEND_VERIFICATION_LOCKOUT_CONFIG.maxAttempts in handler.ts.
 */
const RESEND_MAX_ATTEMPTS = 5;

/** Send-verification-email endpoint path (Better Auth naming convention). */
const SEND_VERIFICATION_PATH = '/api/auth/send-verification-email';

/** Shared request headers for all test requests. */
const BASE_HEADERS: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'vitest',
    // Simulate a fixed IP so lockout keys are deterministic
    'x-forwarded-for': '10.0.2.1'
};

/**
 * Helper to send a send-verification-email request to the app.
 *
 * @param params - The request parameters
 * @param params.app - App instance
 * @param params.email - Email to request verification for
 * @param params.ip - Optional IP override (x-forwarded-for header)
 * @returns The fetch Response
 */
async function sendVerificationEmail({
    app,
    email,
    ip = '10.0.2.1'
}: {
    app: AppOpenAPI;
    email: string;
    ip?: string;
}): Promise<Response> {
    return app.request(SEND_VERIFICATION_PATH, {
        method: 'POST',
        headers: { ...BASE_HEADERS, 'x-forwarded-for': ip },
        body: JSON.stringify({ email })
    });
}

describe('Auth Send-Verification-Email Lockout Integration', () => {
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
        // Arrange
        const email = `resend-lockout-under-${Date.now()}@example.com`;
        const attemptsBeforeThreshold = RESEND_MAX_ATTEMPTS - 1;

        // Act & Assert: each attempt should NOT return 429
        for (let i = 0; i < attemptsBeforeThreshold; i++) {
            const res = await sendVerificationEmail({ app, email });

            expect(res.status, `Attempt ${i + 1} should not be 429 (got ${res.status})`).not.toBe(
                429
            );
        }
    });

    it('should return 429 after exceeding lockout threshold', async () => {
        // Arrange: exhaust all allowed attempts
        const email = `resend-lockout-over-${Date.now()}@example.com`;

        for (let i = 0; i < RESEND_MAX_ATTEMPTS; i++) {
            await sendVerificationEmail({ app, email });
        }

        // Act: one more attempt should trigger lockout
        const lockedRes = await sendVerificationEmail({ app, email });

        // Assert
        expect(lockedRes.status).toBe(429);
        const body = await lockedRes.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('TOO_MANY_REQUESTS');
    });

    it('should include Retry-After header in the lockout response', async () => {
        // Arrange: trigger lockout
        const email = `resend-lockout-header-${Date.now()}@example.com`;

        for (let i = 0; i < RESEND_MAX_ATTEMPTS; i++) {
            await sendVerificationEmail({ app, email });
        }

        // Act
        const lockedRes = await sendVerificationEmail({ app, email });

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
        const email = `resend-lockout-ip-${Date.now()}@example.com`;
        const lockedIp = '10.0.2.1';
        const otherIp = '10.0.2.2';

        for (let i = 0; i < RESEND_MAX_ATTEMPTS; i++) {
            await sendVerificationEmail({ app, email, ip: lockedIp });
        }

        // Verify the first IP is locked
        const lockedRes = await sendVerificationEmail({ app, email, ip: lockedIp });
        expect(lockedRes.status).toBe(429);

        // Act: same email from a different IP should NOT be locked
        const otherRes = await sendVerificationEmail({ app, email, ip: otherIp });

        // Assert: different IP has a fresh counter — not 429
        expect(otherRes.status, 'Different IP should not be blocked').not.toBe(429);
    });

    it('should lock out even when the email does not exist in the database', async () => {
        // Better Auth returns a non-429 status (success or error) regardless
        // of whether the email is known, to prevent enumeration.
        // We still count every attempt toward the lockout.
        const nonExistentEmail = `resend-nonexistent-${Date.now()}@example.com`;

        for (let i = 0; i < RESEND_MAX_ATTEMPTS; i++) {
            await sendVerificationEmail({ app, email: nonExistentEmail });
        }

        // Assert: next attempt is blocked even though the email is unknown
        const lockedRes = await sendVerificationEmail({ app, email: nonExistentEmail });
        expect(lockedRes.status).toBe(429);
    });
});
