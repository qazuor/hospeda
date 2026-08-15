/**
 * @file auth.deleted-user.test.ts
 *
 * Regression tests for H-163 half (b) — "the delete does not revoke sessions
 * already issued".
 *
 * Measured in production on 2026-08-15: `qazuor+r2gastro` was soft-deleted on
 * the 15th, yet the session it had minted on the 14th stayed valid until the
 * 21st. `authMiddleware` resolves the session through Better Auth and hands the
 * user straight to `actorMiddleware`, which builds a fully-privileged actor
 * without ever consulting `users.deleted_at`.
 *
 * Revoking the session rows at delete time (see the `UserService` soft-delete
 * hook) is necessary but NOT sufficient on its own: `session.cookieCache` is
 * enabled with a five-minute TTL, so a signed cookie can reconstruct the session
 * without reading the row that was just deleted. This request-time gate is what
 * closes that window, and it is the backstop if any other path ever mints a
 * session for a deleted account.
 *
 * The real guard runs here — only `@repo/db` is mocked — so these tests cover
 * the middleware and the predicate together rather than asserting the wiring
 * against a stub of my own code.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../src/types';

const { mockGetSession, limitMock, getDbMock } = vi.hoisted(() => {
    const limit = vi.fn();
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    return {
        mockGetSession: vi.fn(),
        limitMock: limit,
        getDbMock: vi.fn().mockReturnValue({ select })
    };
});

vi.mock('../../src/lib/auth', () => ({
    getAuth: () => ({ api: { getSession: mockGetSession } })
}));

vi.mock('@repo/db', () => ({
    getDb: getDbMock,
    users: { id: 'users.id', deletedAt: 'users.deletedAt' },
    eq: (column: unknown, value: unknown) => ({ column, value })
}));

// Real auth path, not the mock short-circuit: `isMockAuthAllowed()` requires
// HOSPEDA_DISABLE_AUTH === true, so leaving it false exercises `getSession`.
vi.mock('../../src/utils/env', () => ({
    env: { NODE_ENV: 'test', HOSPEDA_DISABLE_AUTH: false, CI: 'true' },
    validateApiEnv: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

const DELETED_USER_ID = '1419a535-c587-4d20-b88e-0e4b3fdd73f0';
const LIVE_USER_ID = '6378b885-0000-4000-8000-000000000001';

/**
 * Builds a probe app that reports what the middleware put on the context.
 *
 * @returns A Hono app exposing the resolved user id, if any.
 */
const buildProbeApp = async () => {
    const { authMiddleware } = await import('../../src/middlewares/auth');
    const app = new Hono<AppBindings>();
    app.use(authMiddleware());
    app.get('/probe', (c) => {
        const user = c.get('user');
        const session = c.get('session');
        return c.json({
            hasUser: !!user,
            hasSession: !!session,
            userId: user?.id ?? null
        });
    });
    return app;
};

/**
 * Shapes a Better Auth `getSession` result for a given account.
 *
 * @param params.userId - The account the session belongs to.
 * @returns A session payload in the shape Better Auth returns.
 */
const sessionFor = (params: { userId: string }) => ({
    session: {
        id: 'e497243a-0000-4000-8000-000000000000',
        userId: params.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        token: 'session-token'
    },
    user: { id: params.userId, email: 'probe@example.com', name: 'Probe' }
});

describe('authMiddleware — soft-deleted accounts (H-163)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('refuses a session belonging to a soft-deleted account', async () => {
        // Arrange — exactly the production shape: Better Auth still resolves the
        // session (its row is intact and unexpired) but the user is deleted.
        mockGetSession.mockResolvedValue(sessionFor({ userId: DELETED_USER_ID }));
        limitMock.mockResolvedValue([{ deletedAt: new Date('2026-08-15T00:25:17Z') }]);

        // Act
        const app = await buildProbeApp();
        const response = await app.request('/probe');
        const body = await response.json();

        // Assert — the account must reach downstream code as a guest, which is
        // the state a normal logout produces (measured: /auth/me -> GUEST, admin
        // routes -> 401).
        expect(body.hasUser).toBe(false);
        expect(body.hasSession).toBe(false);
        expect(body.userId).toBeNull();
    });

    it('still authenticates a LIVE account (positive control)', async () => {
        // Without this the gate could refuse everyone and every assertion above
        // would still pass while the whole site was locked out.
        mockGetSession.mockResolvedValue(sessionFor({ userId: LIVE_USER_ID }));
        limitMock.mockResolvedValue([{ deletedAt: null }]);

        const app = await buildProbeApp();
        const response = await app.request('/probe');
        const body = await response.json();

        expect(body.hasUser).toBe(true);
        expect(body.hasSession).toBe(true);
        expect(body.userId).toBe(LIVE_USER_ID);
    });

    it('leaves an anonymous request untouched and never queries the database', async () => {
        // A guest has no account to check; spending a query on every public
        // request would be a real cost on cached, actor-blind routes.
        mockGetSession.mockResolvedValue(null);

        const app = await buildProbeApp();
        const response = await app.request('/probe');
        const body = await response.json();

        expect(body.hasUser).toBe(false);
        expect(getDbMock).not.toHaveBeenCalled();
    });

    it('refuses the session when the deletion check fails (fails closed)', async () => {
        // An outage must not be an open door. The middleware already degrades a
        // failed session resolution to guest; an unevaluable gate does the same.
        mockGetSession.mockResolvedValue(sessionFor({ userId: LIVE_USER_ID }));
        limitMock.mockRejectedValue(new Error('connection reset'));

        const app = await buildProbeApp();
        const response = await app.request('/probe');
        const body = await response.json();

        expect(body.hasUser).toBe(false);
        expect(body.hasSession).toBe(false);
    });
});
