import { eq, sessions } from '@repo/db';
/**
 * Sign-out session integration tests
 *
 * Verifies that sign-out correctly deletes sessions from the database,
 * invalidates old session tokens, clears cookies, and performs
 * Hospeda-specific cache cleanup. Also validates graceful handling when
 * signing out with an already-expired session.
 *
 * Runs under vitest.config.e2e.ts via `pnpm test:e2e`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';
import { forceVerifyEmail } from '../../e2e/helpers/auth-helpers';
import { testDb } from '../../e2e/setup/test-database';

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

let app: AppOpenAPI;
// Better Auth's CSRF protection (advanced.disableCSRFCheck: false) rejects
// mutating requests without a trusted Origin header (MISSING_OR_NULL_ORIGIN).
// Real browser clients always send one; tests must too. Matches HOSPEDA_SITE_URL.
const TRUSTED_ORIGIN = 'http://localhost:4321';
// `.env.test` sets HOSPEDA_DISABLE_AUTH=true, which makes authMiddleware install
// a Bearer-only mock branch that never inspects cookies (see src/middlewares/auth.ts).
// This suite exercises real cookie-session invalidation, so it forces the real
// Better Auth branch for its own initApp() instance and restores the original in
// afterAll (vitest.config.e2e.ts runs all e2e files in a single fork, so a stray
// override would leak into later files that rely on the mock branch).
const ORIGINAL_DISABLE_AUTH = process.env.HOSPEDA_DISABLE_AUTH;
const testEmail = `test-signout-${Date.now()}@example.com`;
const testPassword = 'TestPassword123!';
let _sessionCookie: string;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
    process.env.HOSPEDA_DISABLE_AUTH = 'false';
    validateApiEnv();
    app = initApp();
    await testDb.setup();

    // Create test user via Better Auth signup
    const signupRes = await app.request('/api/auth/sign-up/email', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'user-agent': 'vitest',
            origin: TRUSTED_ORIGIN
        },
        body: JSON.stringify({
            email: testEmail,
            password: testPassword,
            name: 'Signout Test User'
        })
    });

    const setCookie = signupRes.headers.get('set-cookie');
    _sessionCookie = setCookie?.split(';')[0] ?? '';

    // Remove the fire-and-forget email-verify race (see forceVerifyEmail docs).
    await forceVerifyEmail({ email: testEmail });
});

afterAll(async () => {
    await testDb.teardown();
    process.env.HOSPEDA_DISABLE_AUTH = ORIGINAL_DISABLE_AUTH;
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Signs in with the shared test credentials and returns the session cookie
 * value (the `name=value` portion only, without directives).
 */
async function signIn(): Promise<string> {
    const res = await app.request('/api/auth/sign-in/email', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'user-agent': 'vitest',
            origin: TRUSTED_ORIGIN
        },
        body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    const setCookie = res.headers.get('set-cookie');
    return setCookie?.split(';')[0] ?? '';
}

/**
 * Extracts the raw session token from a `better-auth.session_token=<value>`
 * cookie string returned by the sign-in endpoint.
 */
function extractTokenFromCookie(cookie: string): string | null {
    const match = /better-auth\.session_token=([^;]+)/.exec(cookie);
    if (!match?.[1]) {
        return null;
    }
    // Better Auth signs the cookie value as `<token>.<signature>` and
    // URL-encodes it, while the `sessions.token` column stores only `<token>`.
    // Decode and strip the signature so the value matches the DB row.
    return decodeURIComponent(match[1]).split('.')[0] ?? null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Sign-out session integration tests', () => {
    it('should delete session from DB on signout', async () => {
        // Arrange
        const cookie = await signIn();
        const token = extractTokenFromCookie(cookie);
        const db = testDb.getDb();

        // Confirm session exists before signout
        const before = token
            ? await db.select().from(sessions).where(eq(sessions.token, token))
            : [];
        expect(before.length).toBeGreaterThanOrEqual(1);

        // Act
        const signoutRes = await app.request('/api/auth/sign-out', {
            method: 'POST',
            headers: {
                cookie,
                'user-agent': 'vitest',
                origin: TRUSTED_ORIGIN
            }
        });

        // Assert - signout responded successfully
        expect(signoutRes.status).toBe(200);

        // Assert - session no longer exists in DB
        if (token) {
            const after = await db.select().from(sessions).where(eq(sessions.token, token));
            expect(after.length).toBe(0);
        }
    });

    it('should reject old token after signout', async () => {
        // Arrange
        const cookie = await signIn();

        // Sign out to invalidate the session
        await app.request('/api/auth/sign-out', {
            method: 'POST',
            headers: {
                cookie,
                'user-agent': 'vitest',
                origin: TRUSTED_ORIGIN
            }
        });

        // Act - attempt to use invalidated cookie on an authenticated endpoint
        const meRes = await app.request('/api/v1/public/auth/me', {
            method: 'GET',
            headers: {
                cookie,
                'user-agent': 'vitest',
                origin: TRUSTED_ORIGIN
            }
        });

        // Assert - session is no longer valid; the user is treated as a guest
        // (the endpoint may return 200 with isAuthenticated: false, or 401)
        if (meRes.status === 200) {
            const meBody = await meRes.json();
            // If the endpoint accepts guests it must indicate unauthenticated state
            expect(meBody?.data?.isAuthenticated ?? meBody?.isAuthenticated ?? false).toBe(false);
        } else {
            expect(meRes.status).toBe(401);
        }
    });

    it('should clear cookie on signout', async () => {
        // Arrange
        const cookie = await signIn();

        // Act
        const signoutRes = await app.request('/api/auth/sign-out', {
            method: 'POST',
            headers: {
                cookie,
                'user-agent': 'vitest',
                origin: TRUSTED_ORIGIN
            }
        });

        // Assert - Better Auth must send a Set-Cookie header that clears the
        // session token by setting Max-Age=0 or an expired date
        const setCookie = signoutRes.headers.get('set-cookie') ?? '';
        expect(setCookie).toContain('better-auth.session_token');

        const hasClearDirective =
            setCookie.includes('Max-Age=0') ||
            setCookie.includes('max-age=0') ||
            setCookie.includes('expires=Thu, 01 Jan 1970');
        expect(hasClearDirective).toBe(true);
    });

    it('should return cacheCleared from Hospeda cleanup endpoint', async () => {
        // Arrange - sign in to obtain a valid authenticated session
        const cookie = await signIn();

        // Act - call the Hospeda cleanup endpoint BEFORE Better Auth signout
        // (order matters: cleanup reads the session, then Better Auth destroys it)
        const cleanupRes = await app.request('/api/v1/public/auth/signout', {
            method: 'POST',
            headers: {
                cookie,
                'user-agent': 'vitest',
                origin: TRUSTED_ORIGIN
            }
        });

        // Assert
        expect(cleanupRes.status).toBe(200);
        // createSimpleRoute wraps the handler payload as { success, data, metadata },
        // so the endpoint's `cacheCleared` field lives under `data`.
        const cleanupBody = await cleanupRes.json();
        expect(cleanupBody.data).toHaveProperty('cacheCleared');
        expect(typeof cleanupBody.data.cacheCleared).toBe('boolean');
    });

    it('should handle already-expired session gracefully on Better Auth signout', async () => {
        // Arrange
        const cookie = await signIn();

        // First signout - invalidates the session
        await app.request('/api/auth/sign-out', {
            method: 'POST',
            headers: {
                cookie,
                'user-agent': 'vitest',
                origin: TRUSTED_ORIGIN
            }
        });

        // Act - second signout with the same (now invalid) cookie
        const res2 = await app.request('/api/auth/sign-out', {
            method: 'POST',
            headers: {
                cookie,
                'user-agent': 'vitest',
                origin: TRUSTED_ORIGIN
            }
        });

        // Assert - must not crash (no 5xx)
        expect(res2.status).toBeLessThan(500);
    });

    it('should handle already-expired session gracefully on Hospeda cleanup', async () => {
        // Arrange
        const cookie = await signIn();

        // Better Auth signout first - destroys the session in DB
        await app.request('/api/auth/sign-out', {
            method: 'POST',
            headers: {
                cookie,
                'user-agent': 'vitest',
                origin: TRUSTED_ORIGIN
            }
        });

        // Act - Hospeda cleanup with the now-invalid cookie
        const cleanupRes = await app.request('/api/v1/public/auth/signout', {
            method: 'POST',
            headers: {
                cookie,
                'user-agent': 'vitest',
                origin: TRUSTED_ORIGIN
            }
        });

        // Assert - should return 200 with cacheCleared: false (no user to clear)
        expect(cleanupRes.status).toBe(200);
        const body = await cleanupRes.json();
        expect(body.data.cacheCleared).toBe(false);
    });
});
