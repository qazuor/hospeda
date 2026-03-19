/**
 * Integration tests for brute-force login lockout flow.
 * Validates the end-to-end lockout behavior against the real app.
 *
 * SPEC-026 T-008: Brute-force login lockout integration test.
 *
 * Uses a reduced MAX_ATTEMPTS (3) for faster test execution.
 * Runs under vitest.config.e2e.ts with real database via testDb.
 *
 * @module login-lockout.test
 */

// Set lockout threshold BEFORE any imports so the lazy config picks it up
process.env.HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS = '3';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearLockoutStore } from '../../../src/middlewares/auth-lockout';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';

/** Maximum failed attempts before lockout (matches process.env override) */
const MAX_ATTEMPTS = 3;

/** Sign-in endpoint path */
const SIGN_IN_PATH = '/api/auth/sign-in/email';

/** Sign-up endpoint path */
const SIGN_UP_PATH = '/api/auth/sign-up/email';

/** Shared request headers for all test requests */
const BASE_HEADERS: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'vitest'
};

/** Test user credentials */
const TEST_EMAIL = `lockout-test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';
const WRONG_PASSWORD = 'WrongPassword999!';

/**
 * Helper to send a sign-in request to the app.
 *
 * @param params - The request parameters
 * @param params.app - Hono app instance
 * @param params.email - Email to sign in with
 * @param params.password - Password to sign in with
 * @returns The fetch Response
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
 * Helper to send a sign-up request to the app.
 *
 * @param params - The request parameters
 * @param params.app - Hono app instance
 * @param params.email - Email to register
 * @param params.password - Password for new account
 * @param params.name - Display name for the user
 * @returns The fetch Response
 */
async function signUp({
    app,
    email,
    password,
    name
}: {
    app: AppOpenAPI;
    email: string;
    password: string;
    name: string;
}): Promise<Response> {
    return app.request(SIGN_UP_PATH, {
        method: 'POST',
        headers: BASE_HEADERS,
        body: JSON.stringify({ email, password, name })
    });
}

describe('Auth Login Lockout Integration', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        validateApiEnv();
        app = initApp();

        // Create a test user via Better Auth signup
        const signUpRes = await signUp({
            app,
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
            name: 'Lockout Test User'
        });

        // Accept 200 (created) or 409 (already exists from a previous run)
        if (signUpRes.status !== 200 && signUpRes.status !== 409) {
            const body = await signUpRes.text();
            throw new Error(`Failed to create test user (status ${signUpRes.status}): ${body}`);
        }
    });

    afterEach(async () => {
        // Reset lockout state between tests to prevent pollution
        await clearLockoutStore();
    });

    it('should allow login attempts before reaching lockout threshold', async () => {
        // Arrange: attempt fewer than MAX_ATTEMPTS failed logins
        const attemptsBeforeThreshold = MAX_ATTEMPTS - 1;

        // Act & Assert: each attempt should return 401 (invalid credentials), not 429
        for (let i = 0; i < attemptsBeforeThreshold; i++) {
            const res = await signIn({
                app,
                email: TEST_EMAIL,
                password: WRONG_PASSWORD
            });

            expect(res.status, `Attempt ${i + 1} should be 401, not 429`).not.toBe(429);
            // Better Auth returns 401 or 200-with-error for invalid credentials
            // The key assertion is that it is NOT 429 (not locked out)
        }
    });

    it('should return 429 after exceeding lockout threshold', async () => {
        // Arrange: exhaust all allowed attempts
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await signIn({
                app,
                email: TEST_EMAIL,
                password: WRONG_PASSWORD
            });
        }

        // Act: one more attempt should trigger lockout
        const lockedRes = await signIn({
            app,
            email: TEST_EMAIL,
            password: WRONG_PASSWORD
        });

        // Assert
        expect(lockedRes.status).toBe(429);
        const body = await lockedRes.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('ACCOUNT_LOCKED');
    });

    it('should include Retry-After header in lockout response', async () => {
        // Arrange: trigger lockout
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await signIn({
                app,
                email: TEST_EMAIL,
                password: WRONG_PASSWORD
            });
        }

        // Act: attempt after lockout
        const lockedRes = await signIn({
            app,
            email: TEST_EMAIL,
            password: WRONG_PASSWORD
        });

        // Assert
        expect(lockedRes.status).toBe(429);

        const retryAfter = lockedRes.headers.get('retry-after');
        expect(retryAfter).toBeTruthy();

        const retryAfterSeconds = Number(retryAfter);
        expect(retryAfterSeconds).toBeGreaterThan(0);

        // Also verify the body includes retryAfter
        const body = await lockedRes.json();
        expect(body.error.retryAfter).toBeGreaterThan(0);
    });

    it('should reset lockout counter after successful login', async () => {
        // Arrange: accumulate some failed attempts (but not enough to lock)
        const attemptsBeforeThreshold = MAX_ATTEMPTS - 1;

        for (let i = 0; i < attemptsBeforeThreshold; i++) {
            await signIn({
                app,
                email: TEST_EMAIL,
                password: WRONG_PASSWORD
            });
        }

        // Act: successful login should reset the counter
        const successRes = await signIn({
            app,
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });

        // Verify successful login (200 with no error)
        expect(successRes.status).toBe(200);

        // Act: after reset, failed attempts should count from zero again.
        // Make (MAX_ATTEMPTS - 1) more failed attempts.. should NOT trigger lockout.
        for (let i = 0; i < attemptsBeforeThreshold; i++) {
            const res = await signIn({
                app,
                email: TEST_EMAIL,
                password: WRONG_PASSWORD
            });

            expect(res.status, `Post-reset attempt ${i + 1} should not be 429`).not.toBe(429);
        }
    });
});
