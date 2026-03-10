import { eq, sessions, users } from '@repo/db';
/**
 * Multi-session sign-out integration tests (SPEC-026 T-014)
 *
 * Verifies that signing out with one session does not invalidate other
 * concurrent sessions for the same user. Also validates re-login after
 * signout and sequential signout of all sessions.
 *
 * Runs under vitest.config.e2e.ts via `pnpm test:e2e`.
 */
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
let testCounter = 0;

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
 * Generates a unique email address for each test to avoid cross-test
 * interference.
 */
function uniqueEmail(): string {
    testCounter += 1;
    return `test-multi-${Date.now()}-${testCounter}@example.com`;
}

/**
 * Creates a new test user via the Better Auth sign-up endpoint.
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
            name: 'Multi Session Test User'
        })
    });

    expect(res.status).toBeLessThan(400);

    return email;
}

/**
 * Signs in with the given credentials and returns the session cookie
 * string (the `name=value` portion only, without directives).
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
 * @returns `true` if the session is valid and authenticated, `false` otherwise.
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
 * Looks up a user by email and returns the user ID, or null if not found.
 */
async function getUserIdByEmail({ email }: { readonly email: string }): Promise<string | null> {
    const db = testDb.getDb();
    const rows = await db.select().from(users).where(eq(users.email, email));
    return rows[0]?.id ?? null;
}

/**
 * Counts the number of sessions in the DB for a given user ID.
 */
async function countSessionsForUser({ userId }: { readonly userId: string }): Promise<number> {
    const db = testDb.getDb();
    const rows = await db.select().from(sessions).where(eq(sessions.userId, userId));
    return rows.length;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Multi-session sign-out integration tests', () => {
    it('should only invalidate the signed-out session, not other active sessions', async () => {
        // Arrange - create user and two concurrent sessions
        const email = await createTestUser();
        const sessionA = await signIn({ email });
        const sessionB = await signIn({ email });

        // Verify both sessions are valid
        const authA = await isAuthenticated({ cookie: sessionA });
        const authB = await isAuthenticated({ cookie: sessionB });
        expect(authA).toBe(true);
        expect(authB).toBe(true);

        // Act - sign out only sessionA
        const signoutRes = await signOut({ cookie: sessionA });
        expect(signoutRes.status).toBe(200);

        // Assert - sessionA is now invalid
        const authAAfter = await isAuthenticated({ cookie: sessionA });
        expect(authAAfter).toBe(false);

        // Assert - sessionB is still valid
        const authBAfter = await isAuthenticated({ cookie: sessionB });
        expect(authBAfter).toBe(true);

        // Verify in DB: at least one session remains for this user
        const userId = await getUserIdByEmail({ email });
        expect(userId).not.toBeNull();
        const remaining = await countSessionsForUser({ userId: userId as string });
        expect(remaining).toBeGreaterThanOrEqual(1);
    });

    it('should allow re-login after signout while other sessions remain active', async () => {
        // Arrange - create user and two sessions
        const email = await createTestUser();
        const sessionA = await signIn({ email });
        const sessionB = await signIn({ email });

        // Act - sign out sessionA
        await signOut({ cookie: sessionA });

        // Act - sign in again to get sessionC
        const sessionC = await signIn({ email });

        // Assert - sessionC is valid
        const authC = await isAuthenticated({ cookie: sessionC });
        expect(authC).toBe(true);

        // Assert - sessionB is still valid
        const authBAfter = await isAuthenticated({ cookie: sessionB });
        expect(authBAfter).toBe(true);

        // Assert - sessionA remains invalid
        const authAAfter = await isAuthenticated({ cookie: sessionA });
        expect(authAAfter).toBe(false);
    });

    it('should handle signing out all sessions sequentially', async () => {
        // Arrange - create user and three sessions
        const email = await createTestUser();
        const session1 = await signIn({ email });
        const session2 = await signIn({ email });
        const session3 = await signIn({ email });

        const userId = await getUserIdByEmail({ email });
        expect(userId).not.toBeNull();

        // Verify all three sessions are valid before signout
        const auth1Before = await isAuthenticated({ cookie: session1 });
        const auth2Before = await isAuthenticated({ cookie: session2 });
        const auth3Before = await isAuthenticated({ cookie: session3 });
        expect(auth1Before).toBe(true);
        expect(auth2Before).toBe(true);
        expect(auth3Before).toBe(true);

        // Act & Assert - sign out session1
        await signOut({ cookie: session1 });
        const auth1After = await isAuthenticated({ cookie: session1 });
        expect(auth1After).toBe(false);
        // sessions 2 and 3 should still be valid
        expect(await isAuthenticated({ cookie: session2 })).toBe(true);
        expect(await isAuthenticated({ cookie: session3 })).toBe(true);

        // Act & Assert - sign out session2
        await signOut({ cookie: session2 });
        const auth2After = await isAuthenticated({ cookie: session2 });
        expect(auth2After).toBe(false);
        // session3 should still be valid
        expect(await isAuthenticated({ cookie: session3 })).toBe(true);

        // Act & Assert - sign out session3
        await signOut({ cookie: session3 });
        const auth3After = await isAuthenticated({ cookie: session3 });
        expect(auth3After).toBe(false);

        // Verify no sessions remain in DB for this user
        const finalCount = await countSessionsForUser({ userId: userId as string });
        expect(finalCount).toBe(0);
    });
});
