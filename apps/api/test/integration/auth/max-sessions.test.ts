import { eq, sessions, users } from '@repo/db';
/**
 * Max sessions per user integration tests (SPEC-026 GAP-024)
 *
 * Verifies that the per-user session limit (MAX_SESSIONS_PER_USER = 10) is
 * enforced via FIFO eviction in the databaseHooks.session.create.before hook.
 *
 * When a user exceeds the limit, the oldest session is deleted automatically
 * so the new sign-in succeeds. The evicted session becomes invalid.
 *
 * Runs under vitest.config.e2e.ts via `pnpm test:e2e`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Must match MAX_SESSIONS_PER_USER in apps/api/src/lib/auth.ts */
const MAX_SESSIONS_PER_USER = 10;

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
    return `test-max-sessions-${Date.now()}-${testCounter}@example.com`;
}

/**
 * Creates a new test user via the Better Auth sign-up endpoint and
 * returns their email address.
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
            name: 'Max Sessions Test User'
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
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    return rows[0]?.id ?? null;
}

/**
 * Returns all session IDs for a given user, ordered by creation time ascending.
 */
async function getSessionsForUser({
    userId
}: {
    readonly userId: string;
}): Promise<{ id: string }[]> {
    const db = testDb.getDb();
    return db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, userId))
        .orderBy(sessions.createdAt);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Max sessions per user enforcement', () => {
    it('should allow up to MAX_SESSIONS_PER_USER concurrent sessions', async () => {
        // Arrange
        const email = await createTestUser();
        const userId = await getUserIdByEmail({ email });
        expect(userId).not.toBeNull();

        // Act - create exactly MAX_SESSIONS_PER_USER sessions
        const cookies: string[] = [];
        for (let i = 0; i < MAX_SESSIONS_PER_USER; i++) {
            const cookie = await signIn({ email });
            cookies.push(cookie);
        }

        // Assert - all sessions are active and the DB has exactly MAX_SESSIONS_PER_USER rows
        const dbSessions = await getSessionsForUser({ userId: userId as string });
        expect(dbSessions.length).toBe(MAX_SESSIONS_PER_USER);

        // Most recent session must still be valid
        const lastCookie = cookies[cookies.length - 1] as string;
        expect(await isAuthenticated({ cookie: lastCookie })).toBe(true);
    });

    it('should evict the oldest session when limit is exceeded', async () => {
        // Arrange - create a user and fill to the limit
        const email = await createTestUser();
        const userId = await getUserIdByEmail({ email });
        expect(userId).not.toBeNull();

        const cookies: string[] = [];
        for (let i = 0; i < MAX_SESSIONS_PER_USER; i++) {
            const cookie = await signIn({ email });
            cookies.push(cookie);
        }

        // Verify we are at the limit
        const beforeEviction = await getSessionsForUser({ userId: userId as string });
        expect(beforeEviction.length).toBe(MAX_SESSIONS_PER_USER);

        const firstSessionId = beforeEviction[0]?.id;
        expect(firstSessionId).toBeDefined();

        // Act - sign in one more time, which should trigger eviction
        const newCookie = await signIn({ email });

        // Assert - session count is still MAX_SESSIONS_PER_USER (one evicted, one added)
        const afterEviction = await getSessionsForUser({ userId: userId as string });
        expect(afterEviction.length).toBe(MAX_SESSIONS_PER_USER);

        // Assert - the oldest session was removed from the database
        const oldestStillExists = afterEviction.some((s) => s.id === firstSessionId);
        expect(oldestStillExists).toBe(false);

        // Assert - the new session is valid
        expect(await isAuthenticated({ cookie: newCookie })).toBe(true);
    });

    it('should evict the oldest session and not the newest when limit is exceeded', async () => {
        // Arrange - create user and fill sessions to the limit, recording cookies
        const email = await createTestUser();
        const cookies: string[] = [];
        for (let i = 0; i < MAX_SESSIONS_PER_USER; i++) {
            const cookie = await signIn({ email });
            cookies.push(cookie);
        }

        // The first session cookie (oldest) and the last (newest before overflow)
        const oldestCookie = cookies[0] as string;
        const newestCookie = cookies[MAX_SESSIONS_PER_USER - 1] as string;

        // Both should be valid before overflow
        expect(await isAuthenticated({ cookie: oldestCookie })).toBe(true);
        expect(await isAuthenticated({ cookie: newestCookie })).toBe(true);

        // Act - trigger eviction
        const overflowCookie = await signIn({ email });

        // Assert - the newest-before-overflow session is still valid
        expect(await isAuthenticated({ cookie: newestCookie })).toBe(true);

        // Assert - the overflow session is valid
        expect(await isAuthenticated({ cookie: overflowCookie })).toBe(true);

        // Assert - the oldest session is now invalid
        // (Better Auth may return 200 with isAuthenticated: false, or 401)
        expect(await isAuthenticated({ cookie: oldestCookie })).toBe(false);
    });

    it('should allow consecutive sign-ins beyond the limit without error', async () => {
        // Arrange
        const email = await createTestUser();
        const userId = await getUserIdByEmail({ email });
        expect(userId).not.toBeNull();

        // Act - create double the limit (each new sign-in evicts the oldest)
        const allCookies: string[] = [];
        for (let i = 0; i < MAX_SESSIONS_PER_USER * 2; i++) {
            const cookie = await signIn({ email });
            allCookies.push(cookie);
        }

        // Assert - session count never exceeds the limit
        const finalSessions = await getSessionsForUser({ userId: userId as string });
        expect(finalSessions.length).toBe(MAX_SESSIONS_PER_USER);

        // Assert - the most recent session is still valid
        const latestCookie = allCookies[allCookies.length - 1] as string;
        expect(await isAuthenticated({ cookie: latestCookie })).toBe(true);
    });

    it('should not evict sessions when below the limit', async () => {
        // Arrange
        const email = await createTestUser();
        const userId = await getUserIdByEmail({ email });
        expect(userId).not.toBeNull();

        const sessionCount = MAX_SESSIONS_PER_USER - 1;
        const cookies: string[] = [];
        for (let i = 0; i < sessionCount; i++) {
            const cookie = await signIn({ email });
            cookies.push(cookie);
        }

        // Act - verify all sessions are present and valid
        const dbSessions = await getSessionsForUser({ userId: userId as string });
        expect(dbSessions.length).toBe(sessionCount);

        // Assert - all sessions are still authenticated
        const firstCookie = cookies[0] as string;
        const lastCookie = cookies[cookies.length - 1] as string;
        expect(await isAuthenticated({ cookie: firstCookie })).toBe(true);
        expect(await isAuthenticated({ cookie: lastCookie })).toBe(true);
    });

    it('should enforce session limits per user independently (user isolation)', async () => {
        // Arrange - two independent users, each fills to the limit
        const emailA = await createTestUser();
        const emailB = await createTestUser();

        const userIdA = await getUserIdByEmail({ email: emailA });
        const userIdB = await getUserIdByEmail({ email: emailB });
        expect(userIdA).not.toBeNull();
        expect(userIdB).not.toBeNull();

        // Fill user A to the session limit, recording the last cookie for later validation
        const cookiesA: string[] = [];
        for (let i = 0; i < MAX_SESSIONS_PER_USER; i++) {
            cookiesA.push(await signIn({ email: emailA }));
        }
        // Confirm the last user-A session is currently valid (pre-overflow baseline)
        const lastCookieA = cookiesA[cookiesA.length - 1] as string;
        expect(await isAuthenticated({ cookie: lastCookieA })).toBe(true);

        // Fill user B to the session limit
        const cookiesB: string[] = [];
        for (let i = 0; i < MAX_SESSIONS_PER_USER; i++) {
            cookiesB.push(await signIn({ email: emailB }));
        }

        // Verify both users are independently at the limit
        const sessionsA = await getSessionsForUser({ userId: userIdA as string });
        const sessionsB = await getSessionsForUser({ userId: userIdB as string });
        expect(sessionsA.length).toBe(MAX_SESSIONS_PER_USER);
        expect(sessionsB.length).toBe(MAX_SESSIONS_PER_USER);

        // Act - overflow user A by one additional sign-in
        const overflowCookieA = await signIn({ email: emailA });

        // Assert - user A's session count stays at the limit (eviction happened)
        const sessionsAAfter = await getSessionsForUser({ userId: userIdA as string });
        expect(sessionsAAfter.length).toBe(MAX_SESSIONS_PER_USER);

        // Assert - user B's sessions are completely unaffected
        const sessionsBAfter = await getSessionsForUser({ userId: userIdB as string });
        expect(sessionsBAfter.length).toBe(MAX_SESSIONS_PER_USER);

        // Confirm the session IDs for user B are identical before and after
        const idsBefore = sessionsB.map((s) => s.id).sort();
        const idsAfter = sessionsBAfter.map((s) => s.id).sort();
        expect(idsAfter).toEqual(idsBefore);

        // Assert - user B's most-recent session is still valid
        const lastCookieB = cookiesB[cookiesB.length - 1] as string;
        expect(await isAuthenticated({ cookie: lastCookieB })).toBe(true);

        // Assert - user A's overflow session is valid
        expect(await isAuthenticated({ cookie: overflowCookieA })).toBe(true);
    });

    it('should keep exactly MAX_SESSIONS_PER_USER sessions when limit is reached exactly', async () => {
        // Arrange - create user and sign in exactly MAX_SESSIONS_PER_USER times
        const email = await createTestUser();
        const userId = await getUserIdByEmail({ email });
        expect(userId).not.toBeNull();

        for (let i = 0; i < MAX_SESSIONS_PER_USER; i++) {
            await signIn({ email });
        }

        // Assert - count is exactly the limit, not one more or one less
        const dbSessions = await getSessionsForUser({ userId: userId as string });
        expect(dbSessions.length).toBe(MAX_SESSIONS_PER_USER);
        expect(dbSessions.length).not.toBeGreaterThan(MAX_SESSIONS_PER_USER);
    });

    it('should evict exactly one session (not two) when exceeding limit by one', async () => {
        // Arrange - fill to the limit, record the two oldest session IDs
        const email = await createTestUser();
        const userId = await getUserIdByEmail({ email });
        expect(userId).not.toBeNull();

        for (let i = 0; i < MAX_SESSIONS_PER_USER; i++) {
            await signIn({ email });
        }

        const beforeSessions = await getSessionsForUser({ userId: userId as string });
        expect(beforeSessions.length).toBe(MAX_SESSIONS_PER_USER);

        const oldestId = beforeSessions[0]?.id;
        const secondOldestId = beforeSessions[1]?.id;
        expect(oldestId).toBeDefined();
        expect(secondOldestId).toBeDefined();

        // Act - trigger one eviction
        await signIn({ email });

        // Assert - exactly the oldest was evicted, second-oldest survives
        const afterSessions = await getSessionsForUser({ userId: userId as string });
        expect(afterSessions.length).toBe(MAX_SESSIONS_PER_USER);

        const afterIds = afterSessions.map((s) => s.id);
        expect(afterIds).not.toContain(oldestId);
        expect(afterIds).toContain(secondOldestId);
    });
});
