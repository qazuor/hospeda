/**
 * Audit log verification for sign-out session flows (SPEC-026 T-031 / GAP-020).
 *
 * Uses vi.spyOn on the auditLog function (via module mock) to assert that
 * SESSION_SIGNOUT events are emitted with the correct payload during:
 *   - Normal sign-out of an authenticated session.
 *   - Sign-out of an already-expired/invalid session (no event expected).
 *   - Multi-session sign-out (event emitted once per call).
 *
 * Runs under vitest.config.e2e.ts via `pnpm test:e2e`.
 *
 * @module signout-audit-spy.test
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

// ---------------------------------------------------------------------------
// Module mock — intercept auditLog calls while preserving the real implementation
// ---------------------------------------------------------------------------

const auditLogSpy = vi.fn();

vi.mock('../../../src/utils/audit-logger', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../src/utils/audit-logger')>();
    return {
        ...original,
        auditLog: (...args: Parameters<typeof original.auditLog>) => {
            auditLogSpy(...args);
            return original.auditLog(...args);
        }
    };
});

// Re-import AuditEventType after the mock is in place so the reference is correct.
const { AuditEventType } = await import('../../../src/utils/audit-logger');

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

let app: AppOpenAPI;
let userCounter = 0;
const testPassword = 'TestPassword123!';

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
    vi.restoreAllMocks();
});

beforeEach(() => {
    auditLogSpy.mockClear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a unique email address for each test to avoid cross-test pollution.
 */
function uniqueEmail(): string {
    userCounter += 1;
    return `signout-audit-${Date.now()}-${userCounter}@example.com`;
}

/**
 * Creates a test user and returns the email.
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
            name: 'Signout Audit Spy Test User'
        })
    });

    expect(res.status).toBeLessThan(400);
    return email;
}

/**
 * Signs in with the given email and returns the session cookie string
 * (name=value only, without cookie directives).
 *
 * @param params.email - User email to sign in with
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
 * Calls the Hospeda custom signout cleanup endpoint.
 * This is the endpoint that emits the SESSION_SIGNOUT audit event.
 *
 * @param params.cookie - Session cookie to sign out
 * @returns Raw Response
 */
async function hospedaSignout({ cookie }: { readonly cookie: string }): Promise<Response> {
    return app.request('/api/v1/auth/signout', {
        method: 'POST',
        headers: {
            cookie,
            'user-agent': 'vitest'
        }
    });
}

/**
 * Finds a SESSION_SIGNOUT call in the spy's recorded invocations.
 *
 * @returns The call arguments object, or undefined if not found.
 */
function findSignoutAuditCall(): Record<string, unknown> | undefined {
    const call = auditLogSpy.mock.calls.find(
        (args: unknown[]) =>
            (args[0] as { auditEvent: string }).auditEvent === AuditEventType.SESSION_SIGNOUT
    );
    return call?.[0] as Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Sign-out audit log verification [SPEC-026 T-031 / GAP-020]', () => {
    it('should emit SESSION_SIGNOUT audit event with correct payload on signout', async () => {
        // Arrange
        const email = await createTestUser();
        const cookie = await signIn({ email });
        auditLogSpy.mockClear();

        // Act: call Hospeda signout endpoint (not Better Auth's)
        const signoutRes = await hospedaSignout({ cookie });
        expect(signoutRes.status).toBe(200);

        // Assert: SESSION_SIGNOUT was emitted
        const call = findSignoutAuditCall();
        expect(call).toBeDefined();

        expect(call).toMatchObject({
            auditEvent: AuditEventType.SESSION_SIGNOUT
        });

        // Must include actorId (resolved from the session) and ip
        expect(call).toHaveProperty('actorId');
        expect(typeof call?.actorId).toBe('string');
        expect((call?.actorId as string).length).toBeGreaterThan(0);

        expect(call).toHaveProperty('ip');
        expect(typeof call?.ip).toBe('string');
    });

    it('should emit SESSION_SIGNOUT exactly once per signout call', async () => {
        // Arrange
        const email = await createTestUser();
        const cookie = await signIn({ email });
        auditLogSpy.mockClear();

        // Act
        await hospedaSignout({ cookie });

        // Assert: only one SESSION_SIGNOUT call
        const signoutCalls = auditLogSpy.mock.calls.filter(
            (args: unknown[]) =>
                (args[0] as { auditEvent: string }).auditEvent === AuditEventType.SESSION_SIGNOUT
        );
        expect(signoutCalls.length).toBe(1);
    });

    it('should NOT emit SESSION_SIGNOUT when signing out with an already-invalid session', async () => {
        // Arrange: create user, sign in, then invalidate the session via Better Auth
        const email = await createTestUser();
        const cookie = await signIn({ email });

        // Invalidate via Better Auth signout
        await app.request('/api/auth/sign-out', {
            method: 'POST',
            headers: { cookie, 'user-agent': 'vitest' }
        });

        auditLogSpy.mockClear();

        // Act: call Hospeda cleanup with the now-invalid cookie
        const cleanupRes = await hospedaSignout({ cookie });

        // Assert: endpoint should handle gracefully (200 with cacheCleared: false)
        expect(cleanupRes.status).toBe(200);
        const body = await cleanupRes.json();
        expect(body.cacheCleared).toBe(false);

        // Assert: no SESSION_SIGNOUT event — no authenticated actor to audit
        const call = findSignoutAuditCall();
        expect(call).toBeUndefined();
    });

    it('should emit SESSION_SIGNOUT for each session in a multi-session signout sequence', async () => {
        // Arrange: create user with two sessions
        const email = await createTestUser();
        const sessionA = await signIn({ email });
        const sessionB = await signIn({ email });
        auditLogSpy.mockClear();

        // Act: sign out session A
        await hospedaSignout({ cookie: sessionA });

        // Assert: one SESSION_SIGNOUT for sessionA
        const callsAfterA = auditLogSpy.mock.calls.filter(
            (args: unknown[]) =>
                (args[0] as { auditEvent: string }).auditEvent === AuditEventType.SESSION_SIGNOUT
        );
        expect(callsAfterA.length).toBe(1);

        auditLogSpy.mockClear();

        // Act: sign out session B
        await hospedaSignout({ cookie: sessionB });

        // Assert: one SESSION_SIGNOUT for sessionB
        const callsAfterB = auditLogSpy.mock.calls.filter(
            (args: unknown[]) =>
                (args[0] as { auditEvent: string }).auditEvent === AuditEventType.SESSION_SIGNOUT
        );
        expect(callsAfterB.length).toBe(1);
    });

    it('should include a non-empty actorId in SESSION_SIGNOUT that differs between users', async () => {
        // Arrange: create two different users and sign them in
        const emailOne = await createTestUser();
        const emailTwo = await createTestUser();
        const cookieOne = await signIn({ email: emailOne });
        const cookieTwo = await signIn({ email: emailTwo });

        // Act & capture actorId for user one
        auditLogSpy.mockClear();
        await hospedaSignout({ cookie: cookieOne });
        const callOne = findSignoutAuditCall();
        const actorIdOne = callOne?.actorId as string;

        // Act & capture actorId for user two
        auditLogSpy.mockClear();
        await hospedaSignout({ cookie: cookieTwo });
        const callTwo = findSignoutAuditCall();
        const actorIdTwo = callTwo?.actorId as string;

        // Assert: both are defined, non-empty, and different from each other
        expect(actorIdOne).toBeTruthy();
        expect(actorIdTwo).toBeTruthy();
        expect(actorIdOne).not.toBe(actorIdTwo);
    });
});
