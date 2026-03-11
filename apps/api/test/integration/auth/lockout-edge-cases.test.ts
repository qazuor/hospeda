/**
 * Additional integration tests for login lockout edge cases (SPEC-026 T-018/T-026).
 *
 * Covers:
 *   GAP-015-A: Unlock after the lockout window expires (time-based release).
 *   GAP-015-B: Better Auth returning 429 is handled without double-locking.
 *   GAP-015-C: Route isolation — lockout on sign-in does NOT affect forgot-password.
 *   GAP-015-D: Sign-in lockout does not affect an unrelated email on same route.
 *   GAP-002-A: Cross-endpoint isolation — signup lockout does NOT affect forgot-password.
 *   GAP-002-B: Cross-endpoint isolation — resend-verification lockout does NOT affect sign-in.
 *   GAP-002-C: Email normalization — trimmed/uppercased variants share the same counter.
 *
 * Uses a reduced MAX_ATTEMPTS (3) and a short window (2 s) for fast execution.
 * Runs under vitest.config.e2e.ts with a real database via testDb.
 *
 * @module lockout-edge-cases.test
 */

// Override lockout config BEFORE any imports so the lazy getConfig() picks them up.
process.env.HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS = '3';
// Short window so window-expiry tests finish in a few seconds.
process.env.HOSPEDA_AUTH_LOCKOUT_WINDOW_MS = '2000';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearLockoutStore } from '../../../src/middlewares/auth-lockout';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';

/** Maximum failed attempts before lockout (matches process.env override). */
const MAX_ATTEMPTS = 3;

/** Lockout window in milliseconds (matches process.env override). */
const LOCKOUT_WINDOW_MS = 2000;

/** Sign-in endpoint path. */
const SIGN_IN_PATH = '/api/auth/sign-in/email';

/** Forgot-password endpoint path. */
const FORGOT_PASSWORD_PATH = '/api/auth/forget-password';

/** Sign-up endpoint path. */
const SIGN_UP_PATH = '/api/auth/sign-up/email';

/** Send-verification-email endpoint path. */
const SEND_VERIFICATION_PATH = '/api/auth/send-verification-email';

/**
 * Maximum forgot-password attempts before lockout.
 * Matches FORGOT_PASSWORD_LOCKOUT_CONFIG.maxAttempts in handler.ts.
 */
const FORGOT_PASSWORD_MAX_ATTEMPTS = 5;

/**
 * Maximum sign-up attempts before lockout.
 * Matches SIGNUP_LOCKOUT_CONFIG.maxAttempts in handler.ts.
 */
const SIGNUP_MAX_ATTEMPTS = 10;

/**
 * Maximum resend-verification attempts before lockout.
 * Matches RESEND_VERIFICATION_LOCKOUT_CONFIG.maxAttempts in handler.ts.
 */
const RESEND_MAX_ATTEMPTS = 5;

/** Shared request headers. */
const BASE_HEADERS: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'vitest',
    'x-forwarded-for': '10.0.0.99'
};

/** Unique test user email for sign-in lockout tests. */
const TEST_EMAIL = `lockout-edge-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';
const WRONG_PASSWORD = 'WrongPassword999!';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sends a sign-in request to the app.
 *
 * @param params.app - Hono app instance
 * @param params.email - Email to sign in with
 * @param params.password - Password to use
 * @returns The raw Response
 */
async function signIn({
    app,
    email,
    password
}: {
    app: AppOpenAPI;
    email: string;
    password: string;
}): Promise<Response> {
    return app.request(SIGN_IN_PATH, {
        method: 'POST',
        headers: BASE_HEADERS,
        body: JSON.stringify({ email, password })
    });
}

/**
 * Sends a forgot-password request to the app.
 *
 * @param params.app - Hono app instance
 * @param params.email - Email to request a reset for
 * @param params.ip - Optional IP override (x-forwarded-for header)
 * @returns The raw Response
 */
async function forgotPassword({
    app,
    email,
    ip = '10.0.0.99'
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

/**
 * Sends a sign-up request to the app.
 *
 * @param params.app - Hono app instance
 * @param params.email - Email to register
 * @param params.ip - Optional IP override (x-forwarded-for header)
 * @returns The raw Response
 */
async function signUp({
    app,
    email,
    ip = '10.0.0.99'
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
            name: 'Lockout Edge Case User'
        })
    });
}

/**
 * Sends a send-verification-email request to the app.
 *
 * @param params.app - Hono app instance
 * @param params.email - Email to request verification for
 * @param params.ip - Optional IP override (x-forwarded-for header)
 * @returns The raw Response
 */
async function sendVerificationEmail({
    app,
    email,
    ip = '10.0.0.99'
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

/**
 * Waits for the given number of milliseconds.
 *
 * Only used in the window-expiry test where we must let the short lockout
 * window elapse. Kept minimal (slightly over LOCKOUT_WINDOW_MS).
 *
 * @param ms - Milliseconds to wait
 */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Auth lockout edge cases [SPEC-026 T-026 / GAP-015]', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        validateApiEnv();
        app = initApp();

        // Create the test user for sign-in tests
        const res = await app.request(SIGN_UP_PATH, {
            method: 'POST',
            headers: BASE_HEADERS,
            body: JSON.stringify({
                email: TEST_EMAIL,
                password: TEST_PASSWORD,
                name: 'Lockout Edge Case User'
            })
        });

        // Accept 200 (created) or 409 (already exists from a prior run)
        if (res.status !== 200 && res.status !== 409) {
            const body = await res.text();
            throw new Error(`Failed to create test user (status ${res.status}): ${body}`);
        }
    });

    afterEach(async () => {
        // Clear lockout state between tests to avoid pollution
        await clearLockoutStore();
    });

    // -------------------------------------------------------------------------
    // GAP-015-A: Unlock after the lockout window expires
    // -------------------------------------------------------------------------

    it('should unlock automatically after the lockout window expires', async () => {
        // Arrange: trigger lockout by exhausting all attempts
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await signIn({ app, email: TEST_EMAIL, password: WRONG_PASSWORD });
        }

        // Confirm the account is locked
        const lockedRes = await signIn({ app, email: TEST_EMAIL, password: WRONG_PASSWORD });
        expect(lockedRes.status).toBe(429);

        // Act: wait for the lockout window to elapse (add a small buffer)
        await delay(LOCKOUT_WINDOW_MS + 300);

        // Assert: after window expiry the next attempt should NOT be 429
        // (it will be 401 for wrong credentials or 200 for correct ones)
        const afterWindowRes = await signIn({ app, email: TEST_EMAIL, password: WRONG_PASSWORD });
        expect(afterWindowRes.status).not.toBe(429);
    });

    // -------------------------------------------------------------------------
    // GAP-015-B: Better Auth 429 handling
    // -------------------------------------------------------------------------

    it('should not double-count or crash when Better Auth itself returns 429', async () => {
        // Better Auth has its own built-in rate limiting that can return 429
        // independently of the Hospeda lockout middleware.
        // This test verifies that when we receive a 429 from Better Auth
        // (not from our middleware) the system stays coherent.

        // Arrange: hammer the sign-in endpoint rapidly to potentially trigger
        // Better Auth's own rate limiter in addition to ours.
        const attempts = MAX_ATTEMPTS + 5;
        const results: number[] = [];

        for (let i = 0; i < attempts; i++) {
            const res = await signIn({ app, email: TEST_EMAIL, password: WRONG_PASSWORD });
            results.push(res.status);
        }

        // Assert: after MAX_ATTEMPTS we should see 429 responses.
        // The important invariant is that we never see a 5xx (server crash).
        const has5xx = results.some((s) => s >= 500);
        expect(has5xx).toBe(false);

        // At least some responses after the threshold should be 429
        const after429 = results.slice(MAX_ATTEMPTS);
        const all429 = after429.every((s) => s === 429);
        expect(all429).toBe(true);
    });

    // -------------------------------------------------------------------------
    // GAP-015-C: Route isolation — lockout on sign-in does not affect forgot-password
    // -------------------------------------------------------------------------

    it('should not lock out the forgot-password route when sign-in is locked', async () => {
        // Arrange: lock the sign-in route for TEST_EMAIL
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await signIn({ app, email: TEST_EMAIL, password: WRONG_PASSWORD });
        }

        // Confirm sign-in is locked
        const signInLockedRes = await signIn({ app, email: TEST_EMAIL, password: WRONG_PASSWORD });
        expect(signInLockedRes.status).toBe(429);

        // Act: the forgot-password endpoint uses a separate lockout key
        // (email + IP composite key, different from the pure-email sign-in key)
        // so it should NOT be affected by the sign-in lockout.
        const forgotRes = await forgotPassword({ app, email: TEST_EMAIL });

        // Assert: forgot-password must not be blocked (not 429)
        expect(forgotRes.status).not.toBe(429);
    });

    // -------------------------------------------------------------------------
    // GAP-015-D: Sign-in lockout does not affect an unrelated email on the same route
    // -------------------------------------------------------------------------

    it('should not lock out a different email on the same sign-in route', async () => {
        // Arrange: lock TEST_EMAIL on sign-in
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await signIn({ app, email: TEST_EMAIL, password: WRONG_PASSWORD });
        }

        // Confirm TEST_EMAIL is locked
        const lockedRes = await signIn({ app, email: TEST_EMAIL, password: WRONG_PASSWORD });
        expect(lockedRes.status).toBe(429);

        // Act: a completely different email on the same endpoint
        const otherEmail = `other-${Date.now()}@example.com`;
        const otherRes = await signIn({ app, email: otherEmail, password: WRONG_PASSWORD });

        // Assert: different email should not be locked out (will be 401, not 429)
        expect(otherRes.status).not.toBe(429);
    });

    // -------------------------------------------------------------------------
    // GAP-002-A: Cross-endpoint isolation — signup lockout does NOT affect forgot-password
    // -------------------------------------------------------------------------

    it('should not lock out forgot-password when signup is locked for the same email+IP', async () => {
        // Arrange: lock the signup route for a test email and the shared IP
        const email = `cross-signup-fp-${Date.now()}@example.com`;

        for (let i = 0; i < SIGNUP_MAX_ATTEMPTS; i++) {
            await signUp({ app, email });
        }

        // Confirm signup is locked
        const signUpLockedRes = await signUp({ app, email });
        expect(signUpLockedRes.status).toBe(429);

        // Act: forgot-password uses a separate key prefix ("forgot-password:email:ip")
        // so a signup lockout must NOT propagate to forgot-password.
        const forgotRes = await forgotPassword({ app, email });

        // Assert: forgot-password is not blocked (will be 200 regardless of email existence)
        expect(forgotRes.status).not.toBe(429);
    });

    // -------------------------------------------------------------------------
    // GAP-002-B: Cross-endpoint isolation — resend-verification lockout does NOT affect sign-in
    // -------------------------------------------------------------------------

    it('should not lock out sign-in when resend-verification is locked for the same email', async () => {
        // Arrange: lock the resend-verification route for TEST_EMAIL (already created in beforeAll)
        for (let i = 0; i < RESEND_MAX_ATTEMPTS; i++) {
            await sendVerificationEmail({ app, email: TEST_EMAIL });
        }

        // Confirm resend is locked
        const resendLockedRes = await sendVerificationEmail({ app, email: TEST_EMAIL });
        expect(resendLockedRes.status).toBe(429);

        // Act: sign-in uses a pure email key (no prefix, no IP) so a resend lockout
        // must NOT carry over to the sign-in counter.
        const signInRes = await signIn({ app, email: TEST_EMAIL, password: WRONG_PASSWORD });

        // Assert: sign-in responds with 401 (bad credentials) rather than 429
        expect(signInRes.status).not.toBe(429);
    });

    // -------------------------------------------------------------------------
    // GAP-002-C: Email normalization — mixed-case and padded emails share the same counter
    // -------------------------------------------------------------------------

    it('should count attempts from uppercase email against lowercase email on forgot-password', async () => {
        // Arrange: handler normalises email with .toLowerCase().trim() before building the key
        // (see handler.ts: `email.toLowerCase().trim()`). This means all of the variants below
        // should increment the SAME counter.
        const baseEmail = `norm-forgot-${Date.now()}@example.com`;
        const upperEmail = baseEmail.toUpperCase(); // e.g. NORM-FORGOT-...@EXAMPLE.COM
        const paddedEmail = `  ${baseEmail}  `; // leading/trailing whitespace

        // Exhaust the limit with mixed-case and padded variants (they all normalise to baseEmail)
        const attemptsPerVariant = Math.floor(FORGOT_PASSWORD_MAX_ATTEMPTS / 3);
        for (let i = 0; i < attemptsPerVariant; i++) {
            await forgotPassword({ app, email: baseEmail });
        }
        for (let i = 0; i < attemptsPerVariant; i++) {
            await forgotPassword({ app, email: upperEmail });
        }
        // The remaining attempts bring us to or past the threshold
        const remaining = FORGOT_PASSWORD_MAX_ATTEMPTS - attemptsPerVariant * 2;
        for (let i = 0; i < remaining; i++) {
            await forgotPassword({ app, email: paddedEmail });
        }

        // Act: one more attempt with the canonical (lowercase) email should trigger 429
        const lockedRes = await forgotPassword({ app, email: baseEmail });

        // Assert
        expect(lockedRes.status).toBe(429);
    });

    it('should count attempts from mixed-case email against lowercase email on sign-in', async () => {
        // Arrange: sign-in lockout key is the normalised email (no IP).
        // All variants below normalise to TEST_EMAIL, so they all hit the same counter.
        const upperEmail = TEST_EMAIL.toUpperCase();
        const paddedEmail = `  ${TEST_EMAIL}  `;

        const attemptsPerVariant = Math.floor(MAX_ATTEMPTS / 3);
        for (let i = 0; i < attemptsPerVariant; i++) {
            await signIn({ app, email: TEST_EMAIL, password: WRONG_PASSWORD });
        }
        for (let i = 0; i < attemptsPerVariant; i++) {
            await signIn({ app, email: upperEmail, password: WRONG_PASSWORD });
        }
        const remaining = MAX_ATTEMPTS - attemptsPerVariant * 2;
        for (let i = 0; i < remaining; i++) {
            await signIn({ app, email: paddedEmail, password: WRONG_PASSWORD });
        }

        // Act: one more with the canonical form should be 429
        const lockedRes = await signIn({ app, email: TEST_EMAIL, password: WRONG_PASSWORD });

        // Assert
        expect(lockedRes.status).toBe(429);
    });
});
