/**
 * Unit tests for the billing admin guard middleware.
 *
 * Verifies that non-admin users are blocked from performing
 * write operations on admin-only billing resources.
 *
 * @module test/middlewares/billing-admin-guard.middleware
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
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

import { billingAdminGuardMiddleware } from '../../src/middlewares/billing-admin-guard.middleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContext(
    options: {
        method?: string;
        path?: string;
        actorRole?: string | null;
        permissions?: readonly string[];
    } = {}
) {
    const {
        method = 'GET',
        path = '/api/v1/protected/billing/plans',
        actorRole = RoleEnum.USER,
        permissions = []
    } = options;

    return {
        get: vi.fn((key: string) => {
            if (key === 'actor') {
                return actorRole ? { id: 'user-1', role: actorRole, permissions } : null;
            }
            return undefined;
        }),
        json: vi.fn((body: unknown, status: number) => ({ body, status })),
        req: { method, path }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('billingAdminGuardMiddleware', () => {
    let next: Mock;

    beforeEach(() => {
        next = vi.fn().mockResolvedValue(undefined);
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // GET requests always pass through
    // -----------------------------------------------------------------------

    describe('GET requests', () => {
        it('should allow GET /plans for regular users', async () => {
            const ctx = createMockContext({
                method: 'GET',
                path: '/api/v1/protected/billing/plans'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).toHaveBeenCalledOnce();
            expect(ctx.json).not.toHaveBeenCalled();
        });

        it('should allow GET /customers/:id for regular users', async () => {
            const ctx = createMockContext({
                method: 'GET',
                path: '/api/v1/protected/billing/customers/cust_1'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).toHaveBeenCalledOnce();
        });
    });

    // -----------------------------------------------------------------------
    // Plan management: admin only
    // -----------------------------------------------------------------------

    describe('plan management', () => {
        it('should block POST /plans for regular users', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/plans'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).not.toHaveBeenCalled();
            expect(ctx.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'FORBIDDEN' }),
                403
            );
        });

        it('should block PUT /plans/:id for regular users', async () => {
            const ctx = createMockContext({
                method: 'PUT',
                path: '/api/v1/protected/billing/plans/plan_1'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).not.toHaveBeenCalled();
            expect(ctx.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'FORBIDDEN' }),
                403
            );
        });

        it('should block DELETE /plans/:id for regular users', async () => {
            const ctx = createMockContext({
                method: 'DELETE',
                path: '/api/v1/protected/billing/plans/plan_1'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should allow POST /plans for users with ACCESS_API_ADMIN permission', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/plans',
                actorRole: RoleEnum.ADMIN,
                permissions: [PermissionEnum.ACCESS_API_ADMIN]
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).toHaveBeenCalledOnce();
        });

        it('should allow POST /plans for SUPER_ADMIN users with ACCESS_API_ADMIN permission', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/plans',
                actorRole: RoleEnum.SUPER_ADMIN,
                permissions: [PermissionEnum.ACCESS_API_ADMIN]
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).toHaveBeenCalledOnce();
        });
    });

    // -----------------------------------------------------------------------
    // Customer management
    // -----------------------------------------------------------------------

    describe('customer management', () => {
        it('should block POST /customers for regular users', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/customers'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).not.toHaveBeenCalled();
            expect(ctx.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'FORBIDDEN' }),
                403
            );
        });

        it('should block DELETE /customers/:id for regular users', async () => {
            const ctx = createMockContext({
                method: 'DELETE',
                path: '/api/v1/protected/billing/customers/cust_1'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should allow PUT /customers/:id for regular users (self-update)', async () => {
            const ctx = createMockContext({
                method: 'PUT',
                path: '/api/v1/protected/billing/customers/cust_1'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).toHaveBeenCalledOnce();
        });
    });

    // -----------------------------------------------------------------------
    // Subscription management
    // -----------------------------------------------------------------------

    describe('subscription management', () => {
        it('should block POST /subscriptions for regular users', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/subscriptions'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should block DELETE /subscriptions/:id for regular users', async () => {
            const ctx = createMockContext({
                method: 'DELETE',
                path: '/api/v1/protected/billing/subscriptions/sub_1'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Invoice operations
    // -----------------------------------------------------------------------

    describe('invoice operations', () => {
        it('should block POST /invoices for regular users (create)', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/invoices'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should block POST /invoices/:id/void for regular users', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/invoices/inv_1/void'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should allow POST /invoices/:id/pay for regular users', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/invoices/inv_1/pay'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).toHaveBeenCalledOnce();
        });
    });

    // -----------------------------------------------------------------------
    // Payment operations
    // -----------------------------------------------------------------------

    describe('payment operations', () => {
        it('should block POST /payments/:id/refund for regular users', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/payments/pay_1/refund'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should allow POST /payments/:id/refund for users with ACCESS_API_ADMIN permission', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/payments/pay_1/refund',
                actorRole: RoleEnum.ADMIN,
                permissions: [PermissionEnum.ACCESS_API_ADMIN]
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).toHaveBeenCalledOnce();
        });
    });

    // -----------------------------------------------------------------------
    // Entitlement management
    // -----------------------------------------------------------------------

    describe('entitlement management', () => {
        it('should block POST /entitlements for regular users', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/entitlements'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should block DELETE /entitlements/:id for regular users', async () => {
            const ctx = createMockContext({
                method: 'DELETE',
                path: '/api/v1/protected/billing/entitlements/ent_1'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Non-restricted operations
    // -----------------------------------------------------------------------

    describe('non-restricted operations', () => {
        it('should allow POST /checkout for regular users', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/checkout'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).toHaveBeenCalledOnce();
        });

        it('should allow POST /webhooks for regular users', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/webhooks'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).toHaveBeenCalledOnce();
        });
    });

    // -----------------------------------------------------------------------
    // Permission-based access control
    // -----------------------------------------------------------------------

    describe('permission-based access control', () => {
        it('should block ADMIN role WITHOUT ACCESS_API_ADMIN permission', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/plans',
                actorRole: RoleEnum.ADMIN,
                permissions: []
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).not.toHaveBeenCalled();
            expect(ctx.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'FORBIDDEN' }),
                403
            );
        });

        it('should allow non-admin role WITH ACCESS_API_ADMIN permission', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/plans',
                actorRole: RoleEnum.USER,
                permissions: [PermissionEnum.ACCESS_API_ADMIN]
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).toHaveBeenCalledOnce();
        });

        it('should block SUPER_ADMIN without explicit permissions (no role bypass)', async () => {
            const ctx = createMockContext({
                method: 'DELETE',
                path: '/api/v1/protected/billing/subscriptions/sub_1',
                actorRole: RoleEnum.SUPER_ADMIN,
                permissions: []
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should block when permissions array is undefined', async () => {
            const ctx = {
                get: vi.fn((key: string) => {
                    if (key === 'actor') {
                        return { id: 'user-1', role: RoleEnum.ADMIN };
                    }
                    return undefined;
                }),
                json: vi.fn((body: unknown, status: number) => ({ body, status })),
                req: { method: 'POST', path: '/api/v1/protected/billing/plans' }
            };
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).not.toHaveBeenCalled();
            expect(ctx.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'FORBIDDEN' }),
                403
            );
        });
    });

    // -----------------------------------------------------------------------
    // Edge cases
    // -----------------------------------------------------------------------

    describe('edge cases', () => {
        it('should block when actor is null', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/plans',
                actorRole: null
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            expect(next).not.toHaveBeenCalled();
            expect(ctx.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'FORBIDDEN' }),
                403
            );
        });
    });

    // -----------------------------------------------------------------------
    // Path traversal resilience
    // -----------------------------------------------------------------------

    describe('path traversal resilience', () => {
        it('should block directory traversal attempting to bypass admin guard', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/plans/../../customers/other_id'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            // "plans" is still in the path segments, so admin guard triggers
            expect(next).not.toHaveBeenCalled();
            expect(ctx.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'FORBIDDEN' }),
                403
            );
        });

        it('should block null byte injection in resource path', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/plans/plan_123%00/admin'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            // "plans" segment is matched, POST is restricted
            expect(next).not.toHaveBeenCalled();
        });

        it('should block URL-encoded traversal in resource path', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/subscriptions/sub_123%2F..%2Fcustomers'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            // "subscriptions" segment is matched, POST is restricted
            expect(next).not.toHaveBeenCalled();
        });

        it('should block parameter injection in path', async () => {
            const ctx = createMockContext({
                method: 'DELETE',
                path: '/api/v1/protected/billing/entitlements/ent_123;admin=true'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            // "entitlements" segment is matched, DELETE is restricted
            expect(next).not.toHaveBeenCalled();
        });

        it('should block relative path escape attempt', async () => {
            const ctx = createMockContext({
                method: 'POST',
                path: '/api/v1/protected/billing/subscriptions/sub_123/../../plans'
            });
            const middleware = billingAdminGuardMiddleware();

            await middleware(ctx as never, next);

            // Both "subscriptions" and "plans" are in segments, POST is restricted
            expect(next).not.toHaveBeenCalled();
        });
    });
});
