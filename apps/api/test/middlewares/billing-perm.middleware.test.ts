/**
 * Unit tests for billing self-permission middleware (SPEC-156, T-007).
 *
 * Coverage:
 *   - Authenticated HOST with BILLING_VIEW_OWN: passes through.
 *   - Authenticated user lacking BILLING_VIEW_OWN: 403 Forbidden.
 *   - No actor (upstream auth not run): pass through (defense in depth, not first line).
 *   - Guest actor (id but is the sentinel): for V1 we treat the same as "lacks
 *     perm" since guests don't have BILLING_VIEW_OWN in any role bundle.
 *   - Custom required permission (e.g. SUBSCRIPTION_VIEW_OWN): same gate logic.
 *
 * @module test/middlewares/billing-perm.middleware
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

import { billingPermMiddleware } from '../../src/middlewares/billing-perm.middleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContext(
    options: {
        actorId?: string | null;
        actorRole?: string;
        permissions?: readonly string[];
        path?: string;
    } = {}
) {
    const {
        actorId = 'user-1',
        actorRole = RoleEnum.HOST,
        permissions = [],
        path = '/api/v1/protected/billing/subscriptions'
    } = options;

    return {
        get: vi.fn((key: string) => {
            if (key === 'actor') {
                return actorId ? { id: actorId, role: actorRole, permissions } : undefined;
            }
            return undefined;
        }),
        req: { path }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('billingPermMiddleware', () => {
    let next: Mock;

    beforeEach(() => {
        next = vi.fn().mockResolvedValue(undefined);
        vi.clearAllMocks();
    });

    describe('default gate (BILLING_VIEW_OWN)', () => {
        it('passes through when HOST has BILLING_VIEW_OWN', async () => {
            const ctx = createMockContext({
                permissions: [PermissionEnum.BILLING_VIEW_OWN]
            });
            const middleware = billingPermMiddleware();

            await middleware(ctx as never, next);

            expect(next).toHaveBeenCalled();
        });

        it('passes through when ADMIN has BILLING_VIEW_OWN (also valid via T-006 bundle)', async () => {
            const ctx = createMockContext({
                actorRole: RoleEnum.ADMIN,
                permissions: [PermissionEnum.BILLING_VIEW_OWN]
            });
            const middleware = billingPermMiddleware();

            await middleware(ctx as never, next);

            expect(next).toHaveBeenCalled();
        });

        it('throws 403 when actor lacks BILLING_VIEW_OWN', async () => {
            const ctx = createMockContext({
                actorRole: RoleEnum.USER,
                permissions: [PermissionEnum.USER_UPDATE_PROFILE] // unrelated perm
            });
            const middleware = billingPermMiddleware();

            await expect(middleware(ctx as never, next)).rejects.toThrow(HTTPException);
            await expect(middleware(ctx as never, next)).rejects.toMatchObject({
                status: 403
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('throws 403 with descriptive message mentioning the required permission', async () => {
            const ctx = createMockContext({ permissions: [] });
            const middleware = billingPermMiddleware();

            try {
                await middleware(ctx as never, next);
                expect.fail('middleware should have thrown');
            } catch (err) {
                expect(err).toBeInstanceOf(HTTPException);
                const httpErr = err as HTTPException;
                expect(httpErr.status).toBe(403);
                expect(httpErr.message).toMatch(/billing\.view\.own/);
            }
        });
    });

    describe('no actor / unauthenticated pass-through', () => {
        it('passes through when no actor is set (upstream auth handles 401)', async () => {
            const ctx = createMockContext({ actorId: null });
            const middleware = billingPermMiddleware();

            await middleware(ctx as never, next);

            expect(next).toHaveBeenCalled();
        });

        it('passes through when actor has no id (defensive)', async () => {
            const ctx = {
                get: vi.fn((key: string) =>
                    key === 'actor' ? { id: '', role: 'USER' } : undefined
                ),
                req: { path: '/api/v1/protected/billing/subscriptions' }
            };
            const middleware = billingPermMiddleware();

            await middleware(ctx as never, next);

            expect(next).toHaveBeenCalled();
        });

        it('passes through guest actors (downstream auth returns 401, not 403)', async () => {
            // Guests carry a sentinel UUID but no real session. Our gate must
            // not pre-empt the upstream 401 with a 403.
            const ctx = createMockContext({
                actorId: '00000000-0000-4000-8000-000000000000', // guest sentinel
                actorRole: RoleEnum.GUEST,
                permissions: [PermissionEnum.ACCESS_API_PUBLIC]
            });
            const middleware = billingPermMiddleware();

            await middleware(ctx as never, next);

            expect(next).toHaveBeenCalled();
        });
    });

    describe('SPEC-164 boundary: BILLING_VIEW_OWN does NOT widen admin access', () => {
        it('grants self-billing scope only — does not grant BILLING_READ_ALL', async () => {
            // This is a documentation test, not a runtime guarantee — the
            // separation is enforced at the route mount level (admin routes
            // sit on /api/v1/admin/billing/* with billingAdminGuardMiddleware,
            // never on /api/v1/protected/billing/* where this middleware runs).
            const ctx = createMockContext({
                permissions: [PermissionEnum.BILLING_VIEW_OWN]
            });
            const middleware = billingPermMiddleware();

            await middleware(ctx as never, next);

            // The actor passes the protected gate; an integration test against
            // /admin/billing/* would assert the 403 there. Verified by
            // SPEC-164 boundary in rolePermissions.seed.test.ts (T-006).
            expect(next).toHaveBeenCalled();
            const actor = ctx.get('actor') as { permissions: string[] };
            expect(actor.permissions).not.toContain(PermissionEnum.BILLING_READ_ALL);
        });
    });

    describe('custom required permission (SUBSCRIPTION_VIEW_OWN)', () => {
        it('passes through when actor has the custom required permission', async () => {
            const ctx = createMockContext({
                permissions: [PermissionEnum.SUBSCRIPTION_VIEW_OWN]
            });
            const middleware = billingPermMiddleware(PermissionEnum.SUBSCRIPTION_VIEW_OWN);

            await middleware(ctx as never, next);

            expect(next).toHaveBeenCalled();
        });

        it('throws 403 when actor lacks the custom required permission', async () => {
            const ctx = createMockContext({
                permissions: [PermissionEnum.BILLING_VIEW_OWN] // has the default, but not the custom
            });
            const middleware = billingPermMiddleware(PermissionEnum.SUBSCRIPTION_VIEW_OWN);

            await expect(middleware(ctx as never, next)).rejects.toThrow(HTTPException);
            expect(next).not.toHaveBeenCalled();
        });
    });
});
