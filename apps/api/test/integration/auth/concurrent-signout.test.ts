/**
 * Concurrent sign-out integration tests (SPEC-026 T-030 / GAP-022).
 *
 * Verifies that simultaneous sign-out requests from multiple sessions all
 * succeed and that every session is invalidated independently, with no
 * race condition, crash, or orphaned session in the database.
 *
 * Strategy: use Promise.all() to fire N sign-out requests at exactly
 * the same time and then verify each session cookie is rejected afterwards.
 *
 * Runs under vitest.config.e2e.ts via `pnpm test:e2e`.
 *
 * @module concurrent-signout.test
 */

import { eq, sessions, users } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

let app: AppOpenAPI;
const testPassword = 'TestPassword123!';
let userCounter = 0;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
    validateApiEnv();
    app = initApp();
    await testDb.setup();
});

afterAll(async () => {
    await testDb.teardown();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a unique email address for each test to avoid cross-test pollution.
 */
function uniqueEmail(): string {
    userCounter += 1;
    return `concurrent-signout-${Date.now()}-${userCounter}@example.com`;
}

/**
 * Creates a test user via the Better Auth sign-up endpoint.
 *
 * @returns The email of the newly created user.
 */
async function createTestUser(): Promise<string> {
    const email = uniqueEmail();

    const res = await app.request('/api/auth/sign-up/email', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'user-agent': 'vitest'
        },
        body: JSON.stringify({
            email,
            password: testPassword,
            name: 'Concurrent Signout Test User'
        })
    });

    expect(res.status).toBeLessThan(400);
    return email;
}

/**
 * Signs in and returns the session cookie string (name=value only, no directives).
 *
 * @param params.email - User email
 * @returns Session cookie string
 */
async function signIn({ email }: { readonly email: string }): Promise<string> {
    const res = await app.request('/api/auth/sign-in/email', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'user-agent': 'vitest'
        },
        body: JSON.stringify({ email, password: testPassword })
    });

    expect(res.status).toBeLessThan(400);
    const setCookie = res.headers.get('set-cookie');
    const cookie = setCookie?.split(';')[0] ?? '';
    expect(cookie).not.toBe('');
    return cookie;
}

/**
 * Signs out the session identified by the given cookie.
 *
 * @param params.cookie - Session cookie string
 * @returns Raw Response from the sign-out endpoint
 */
async function signOut({ cookie }: { readonly cookie: string }): Promise<Response> {
    return app.request('/api/auth/sign-out', {
        method: 'POST',
        headers: {
            cookie,
            'user-agent': 'vitest'
        }
    });
}

/**
 * Checks whether the provided session cookie is still authenticated.
 *
 * @param params.cookie - Session cookie string
 * @returns `true` if the session is valid, `false` otherwise
 */
async function isAuthenticated({ cookie }: { readonly cookie: string }): Promise<boolean> {
    const res = await app.request('/api/v1/public/auth/me', {
        method: 'GET',
        headers: {
            cookie,
            'user-agent': 'vitest'
        }
    });

    if (res.status === 401) {
        return false;
    }

    const body = await res.json();
    return body?.data?.isAuthenticated ?? body?.isAuthenticated ?? false;
}

/**
 * Returns the number of sessions in the database for a given user ID.
 *
 * @param params.userId - The user's ID
 * @returns Count of active sessions
 */
async function countSessionsForUser({ userId }: { readonly userId: string }): Promise<number> {
    const db = testDb.getDb();
    const rows = await db.select().from(sessions).where(eq(sessions.userId, userId));
    return rows.length;
}

/**
 * Looks up a user by email and returns their ID, or null if not found.
 *
 * @param params.email - The user's email address
 * @returns User ID or null
 */
async function getUserIdByEmail({ email }: { readonly email: string }): Promise<string | null> {
    const db = testDb.getDb();
    const rows = await db.select().from(users).where(eq(users.email, email));
    return rows[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Concurrent sign-out integration tests [SPEC-026 T-030 / GAP-022]', () => {
    it('should invalidate all sessions when signed out concurrently via Promise.all', async () => {
        // Arrange: create a user and establish three concurrent sessions
        const email = await createTestUser();
        const [sessionA, sessionB, sessionC] = await Promise.all([
            signIn({ email }),
            signIn({ email }),
            signIn({ email })
        ]);

        // Verify all three sessions are valid before concurrent signout
        const [authABefore, authBBefore, authCBefore] = await Promise.all([
            isAuthenticated({ cookie: sessionA }),
            isAuthenticated({ cookie: sessionB }),
            isAuthenticated({ cookie: sessionC })
        ]);
        expect(authABefore).toBe(true);
        expect(authBBefore).toBe(true);
        expect(authCBefore).toBe(true);

        // Act: sign out all three sessions simultaneously
        const [resA, resB, resC] = await Promise.all([
            signOut({ cookie: sessionA }),
            signOut({ cookie: sessionB }),
            signOut({ cookie: sessionC })
        ]);

        // Assert: all sign-out requests must succeed (no 5xx)
        expect(resA.status).toBeLessThan(500);
        expect(resB.status).toBeLessThan(500);
        expect(resC.status).toBeLessThan(500);

        // Assert: all sessions are now invalid
        const [authAAfter, authBAfter, authCAfter] = await Promise.all([
            isAuthenticated({ cookie: sessionA }),
            isAuthenticated({ cookie: sessionB }),
            isAuthenticated({ cookie: sessionC })
        ]);
        expect(authAAfter).toBe(false);
        expect(authBAfter).toBe(false);
        expect(authCAfter).toBe(false);
    });

    it('should leave no active sessions in DB after concurrent signout of all sessions', async () => {
        // Arrange: create user with two sessions
        const email = await createTestUser();

        const [session1, session2] = await Promise.all([signIn({ email }), signIn({ email })]);

        const resolvedUserId = await getUserIdByEmail({ email });
        expect(resolvedUserId).not.toBeNull();

        // Confirm sessions exist in DB before signout
        const countBefore = await countSessionsForUser({ userId: resolvedUserId as string });
        expect(countBefore).toBeGreaterThanOrEqual(2);

        // Act: concurrent signout
        await Promise.all([signOut({ cookie: session1 }), signOut({ cookie: session2 })]);

        // Assert: no sessions remain for this user
        const countAfter = await countSessionsForUser({ userId: resolvedUserId as string });
        expect(countAfter).toBe(0);
    });

    it('should handle concurrent signout without server errors even if one session is already invalid', async () => {
        // Arrange: create user with two sessions, invalidate one manually first
        const email = await createTestUser();
        const [sessionX, sessionY] = await Promise.all([signIn({ email }), signIn({ email })]);

        // Pre-invalidate sessionX
        await signOut({ cookie: sessionX });

        // Act: concurrent signout where sessionX is already gone
        const [resX2, resY2] = await Promise.all([
            signOut({ cookie: sessionX }), // already signed out — should be graceful
            signOut({ cookie: sessionY })
        ]);

        // Assert: neither request must cause a 5xx error
        expect(resX2.status).toBeLessThan(500);
        expect(resY2.status).toBeLessThan(500);

        // Assert: sessionY is now also invalidated
        const authYAfter = await isAuthenticated({ cookie: sessionY });
        expect(authYAfter).toBe(false);
    });

    it('should allow a new sign-in after concurrent signout of all previous sessions', async () => {
        // Arrange: create user with two concurrent sessions and sign them both out
        const email = await createTestUser();
        const [sessionM, sessionN] = await Promise.all([signIn({ email }), signIn({ email })]);

        await Promise.all([signOut({ cookie: sessionM }), signOut({ cookie: sessionN })]);

        // Act: sign in fresh after all sessions were concurrently removed
        const sessionNew = await signIn({ email });

        // Assert: new session is valid
        const authNew = await isAuthenticated({ cookie: sessionNew });
        expect(authNew).toBe(true);
    });
});
