/**
 * Unit tests for the user self-service subscription cancel route handler.
 *
 * Tests cover:
 * - Flag OFF (HOSPEDA_USER_CANCEL_ENABLED=false) → 404
 * - Flag ON, billing disabled → 503
 * - Flag ON, no billing customer → 400
 * - Flag ON, no billing instance → 503
 * - Flag ON, invalid body → 400
 * - Happy path: flag on, owner, active sub → 200 soft-cancel result
 * - ServiceError NOT_FOUND → 404
 * - ServiceError FORBIDDEN → 403 (defence-in-depth ownership check)
 * - ServiceError VALIDATION_ERROR (not cancellable) → 422
 * - ServiceError PROVIDER_ERROR → 502
 * - ServiceError PROVIDER_RATE_LIMITED → 503
 * - ServiceError PROVIDER_TIMEOUT → 504
 * - Unexpected error → 500
 * - Admin cancel path UNCHANGED (admin can still use DELETE /subscriptions/:id)
 *
 * @module test/routes/subscription-cancel
 */

import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before any import
// ---------------------------------------------------------------------------

const mockEnv = vi.hoisted(() => ({
    HOSPEDA_USER_CANCEL_ENABLED: false as boolean,
    HOSPEDA_SITE_URL: 'https://hospeda.com.ar'
}));

const { mockGetQZPayBilling } = vi.hoisted(() => ({
    mockGetQZPayBilling: vi.fn()
}));

const { mockSoftCancelSubscription } = vi.hoisted(() => ({
    mockSoftCancelSubscription: vi.fn()
}));

vi.mock('../../src/utils/env', () => ({
    env: mockEnv
}));

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: mockGetQZPayBilling,
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
    billingMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/services/subscription-cancel.service', () => ({
    softCancelSubscription: mockSoftCancelSubscription
}));

vi.mock('../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn(() => ({
        id: 'user-1',
        email: 'user@test.com',
        name: 'Test User'
    }))
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../src/utils/route-factory', () => ({
    createCRUDRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

// Import triggers createCRUDRoute call which stores the handler via the mock
import { handleUserCancelSubscription } from '../../src/routes/billing/subscription-cancel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUBSCRIPTION_ID = 'sub_abc123';
const CUSTOMER_ID = 'cust_xyz456';

const SOFT_CANCEL_RESULT = {
    subscriptionId: SUBSCRIPTION_ID,
    cancelAtPeriodEnd: true as const,
    canceledAt: new Date('2026-06-09T10:00:00Z'),
    accessUntil: new Date('2026-06-30T23:59:59Z')
};

const MOCK_BILLING = {
    subscriptions: {
        getByCustomerId: vi.fn().mockResolvedValue([
            {
                id: SUBSCRIPTION_ID,
                planId: 'plan_pro',
                status: 'active'
            }
        ]),
        get: vi.fn()
    },
    plans: {
        get: vi.fn().mockResolvedValue({ id: 'plan_pro', name: 'Pro Plan' })
    }
};

/**
 * Creates a minimal mock Hono context for the cancel handler.
 */
function createMockContext(
    options: {
        billingEnabled?: boolean;
        billingCustomerId?: string | null;
    } = {}
) {
    const { billingEnabled = true, billingCustomerId = CUSTOMER_ID } = options;

    const contextStore = new Map<string, unknown>([
        ['billingEnabled', billingEnabled],
        ['billingCustomerId', billingCustomerId]
    ]);

    return {
        get: vi.fn((key: string) => contextStore.get(key))
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleUserCancelSubscription', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: flag on
        mockEnv.HOSPEDA_USER_CANCEL_ENABLED = true;
        mockGetQZPayBilling.mockReturnValue(MOCK_BILLING);
        mockSoftCancelSubscription.mockResolvedValue(SOFT_CANCEL_RESULT);
        MOCK_BILLING.subscriptions.getByCustomerId.mockResolvedValue([
            { id: SUBSCRIPTION_ID, planId: 'plan_pro', status: 'active' }
        ]);
        MOCK_BILLING.plans.get.mockResolvedValue({ id: 'plan_pro', name: 'Pro Plan' });
    });

    // -----------------------------------------------------------------------
    // Feature flag: OFF
    // -----------------------------------------------------------------------

    describe('when HOSPEDA_USER_CANCEL_ENABLED is false (flag off)', () => {
        it('returns 404 NOT_FOUND so the route appears non-existent', async () => {
            // Arrange
            mockEnv.HOSPEDA_USER_CANCEL_ENABLED = false;
            const ctx = createMockContext();

            // Act & Assert
            await expect(
                handleUserCancelSubscription(ctx as never, { id: SUBSCRIPTION_ID }, {})
            ).rejects.toMatchObject({ status: 404 });
        });
    });

    // -----------------------------------------------------------------------
    // Billing availability guards
    // -----------------------------------------------------------------------

    describe('when billingEnabled is false', () => {
        it('throws HTTPException 503', async () => {
            // Arrange
            const ctx = createMockContext({ billingEnabled: false });

            // Act & Assert
            await expect(
                handleUserCancelSubscription(ctx as never, { id: SUBSCRIPTION_ID }, {})
            ).rejects.toMatchObject({
                status: 503,
                message: 'Billing service is not configured'
            });
        });
    });

    describe('when billingCustomerId is null', () => {
        it('throws HTTPException 400', async () => {
            // Arrange
            const ctx = createMockContext({ billingCustomerId: null });

            // Act & Assert
            await expect(
                handleUserCancelSubscription(ctx as never, { id: SUBSCRIPTION_ID }, {})
            ).rejects.toMatchObject({
                status: 400,
                message: 'No billing account found'
            });
        });
    });

    describe('when getQZPayBilling returns null', () => {
        it('throws HTTPException 503', async () => {
            // Arrange
            mockGetQZPayBilling.mockReturnValue(null);
            const ctx = createMockContext();

            // Act & Assert
            await expect(
                handleUserCancelSubscription(ctx as never, { id: SUBSCRIPTION_ID }, {})
            ).rejects.toMatchObject({
                status: 503,
                message: 'Billing service is not available'
            });
        });
    });

    // -----------------------------------------------------------------------
    // Route param validation
    // -----------------------------------------------------------------------

    describe('when subscription id param is missing', () => {
        it('throws HTTPException 400', async () => {
            // Arrange
            const ctx = createMockContext();

            // Act & Assert
            await expect(handleUserCancelSubscription(ctx as never, {}, {})).rejects.toMatchObject({
                status: 400
            });
        });
    });

    // -----------------------------------------------------------------------
    // Request body validation
    // -----------------------------------------------------------------------

    describe('when body has reason exceeding max length', () => {
        it('throws HTTPException 400 with validation error', async () => {
            // Arrange
            const ctx = createMockContext();
            const longReason = 'x'.repeat(501);

            // Act & Assert
            await expect(
                handleUserCancelSubscription(
                    ctx as never,
                    { id: SUBSCRIPTION_ID },
                    { reason: longReason }
                )
            ).rejects.toMatchObject({
                status: 400,
                message: 'Invalid request body'
            });
        });
    });

    describe('when body is empty (no reason)', () => {
        it('succeeds — reason is optional', async () => {
            // Arrange
            const ctx = createMockContext();

            // Act
            const result = await handleUserCancelSubscription(
                ctx as never,
                { id: SUBSCRIPTION_ID },
                {}
            );

            // Assert
            expect(mockSoftCancelSubscription).toHaveBeenCalledWith(
                expect.objectContaining({ reason: undefined })
            );
            expect(result).toEqual(SOFT_CANCEL_RESULT);
        });
    });

    // -----------------------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------------------

    describe('happy path: flag on, owner, active sub', () => {
        it('returns 200 soft-cancel result with subscriptionId, cancelAtPeriodEnd, canceledAt, accessUntil', async () => {
            // Arrange
            const ctx = createMockContext();

            // Act
            const result = await handleUserCancelSubscription(
                ctx as never,
                { id: SUBSCRIPTION_ID },
                { reason: 'Switching to competitor' }
            );

            // Assert
            expect(result).toEqual(SOFT_CANCEL_RESULT);
            expect(mockSoftCancelSubscription).toHaveBeenCalledWith(
                expect.objectContaining({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    reason: 'Switching to competitor',
                    recipientEmail: 'user@test.com',
                    userId: 'user-1'
                })
            );
        });

        it('forwards the billing instance to softCancelSubscription', async () => {
            // Arrange
            const ctx = createMockContext();

            // Act
            await handleUserCancelSubscription(ctx as never, { id: SUBSCRIPTION_ID }, {});

            // Assert
            expect(mockSoftCancelSubscription).toHaveBeenCalledWith(
                expect.objectContaining({ billing: MOCK_BILLING })
            );
        });
    });

    // -----------------------------------------------------------------------
    // ServiceError mapping (SPEC-149 path)
    // -----------------------------------------------------------------------

    describe('when service throws ServiceError NOT_FOUND', () => {
        it('maps to 404', async () => {
            // Arrange
            mockSoftCancelSubscription.mockRejectedValue(
                new ServiceError(ServiceErrorCode.NOT_FOUND, 'Subscription not found.')
            );
            const ctx = createMockContext();

            // Act & Assert
            await expect(
                handleUserCancelSubscription(ctx as never, { id: SUBSCRIPTION_ID }, {})
            ).rejects.toMatchObject({ status: 404 });
        });
    });

    describe('when service throws ServiceError FORBIDDEN (non-owner defence-in-depth)', () => {
        it('maps to 403', async () => {
            // Arrange
            mockSoftCancelSubscription.mockRejectedValue(
                new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'You are not authorized to cancel this subscription.'
                )
            );
            const ctx = createMockContext();

            // Act & Assert
            await expect(
                handleUserCancelSubscription(ctx as never, { id: SUBSCRIPTION_ID }, {})
            ).rejects.toMatchObject({ status: 403 });
        });
    });

    describe('when service throws ServiceError VALIDATION_ERROR (not cancellable state)', () => {
        it('maps to 422', async () => {
            // Arrange
            mockSoftCancelSubscription.mockRejectedValue(
                new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    "Cannot soft-cancel a subscription with status 'cancelled'."
                )
            );
            const ctx = createMockContext();

            // Act & Assert
            await expect(
                handleUserCancelSubscription(ctx as never, { id: SUBSCRIPTION_ID }, {})
            ).rejects.toMatchObject({ status: 422 });
        });
    });

    describe('when service throws ServiceError PROVIDER_ERROR', () => {
        it('maps to 502', async () => {
            // Arrange
            mockSoftCancelSubscription.mockRejectedValue(
                new ServiceError(ServiceErrorCode.PROVIDER_ERROR, 'Provider error')
            );
            const ctx = createMockContext();

            // Act & Assert
            await expect(
                handleUserCancelSubscription(ctx as never, { id: SUBSCRIPTION_ID }, {})
            ).rejects.toMatchObject({ status: 502 });
        });
    });

    describe('when service throws ServiceError PROVIDER_RATE_LIMITED', () => {
        it('maps to 503', async () => {
            // Arrange
            mockSoftCancelSubscription.mockRejectedValue(
                new ServiceError(ServiceErrorCode.PROVIDER_RATE_LIMITED, 'Rate limited')
            );
            const ctx = createMockContext();

            // Act & Assert
            await expect(
                handleUserCancelSubscription(ctx as never, { id: SUBSCRIPTION_ID }, {})
            ).rejects.toMatchObject({ status: 503 });
        });
    });

    describe('when service throws ServiceError PROVIDER_TIMEOUT', () => {
        it('maps to 504', async () => {
            // Arrange
            mockSoftCancelSubscription.mockRejectedValue(
                new ServiceError(ServiceErrorCode.PROVIDER_TIMEOUT, 'Timeout')
            );
            const ctx = createMockContext();

            // Act & Assert
            await expect(
                handleUserCancelSubscription(ctx as never, { id: SUBSCRIPTION_ID }, {})
            ).rejects.toMatchObject({ status: 504 });
        });
    });

    describe('when service throws an unexpected error', () => {
        it('maps to 500', async () => {
            // Arrange
            mockSoftCancelSubscription.mockRejectedValue(new Error('DB crashed'));
            const ctx = createMockContext();

            // Act & Assert
            await expect(
                handleUserCancelSubscription(ctx as never, { id: SUBSCRIPTION_ID }, {})
            ).rejects.toMatchObject({ status: 500 });
        });
    });
});

// ---------------------------------------------------------------------------
// Admin guard: admin hard-cancel path UNCHANGED
// ---------------------------------------------------------------------------

describe('billing-admin-guard: cancel allowedSubPaths', () => {
    // This test verifies the middleware change by importing the guard directly.
    // The guard now has 'cancel' in allowedSubPaths, meaning:
    //   - POST /subscriptions/:id/cancel by a non-admin → passes the guard (ownership
    //     middleware handles actual resource verification)
    //   - DELETE /subscriptions/:id by a non-admin → still blocked (hard-cancel is
    //     admin-only, not in allowedSubPaths)

    it('the allowedSubPaths for subscriptions now includes cancel (SPEC-147)', async () => {
        // Import the guard to inspect the compiled constant. We verify the rule
        // shapes indirectly by calling the middleware with a cancel path and a
        // regular user — if 'cancel' is NOT in allowedSubPaths, next() would not
        // be called.

        vi.mock('../../src/utils/logger', () => ({
            apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
        }));

        const { billingAdminGuardMiddleware } = await import(
            '../../src/middlewares/billing-admin-guard.middleware'
        );
        const { PermissionEnum } = await import('@repo/schemas');

        const next = vi.fn().mockResolvedValue(undefined);
        const ctx = {
            get: vi.fn((key: string) => {
                if (key === 'actor') {
                    return { id: 'user-1', role: 'USER', permissions: [] };
                }
                return undefined;
            }),
            json: vi.fn(),
            req: {
                method: 'POST',
                path: '/api/v1/protected/billing/subscriptions/sub_abc/cancel'
            }
        };

        // Act
        const middleware = billingAdminGuardMiddleware();
        await middleware(ctx as never, next);

        // Assert: non-admin can reach /subscriptions/:id/cancel
        expect(next).toHaveBeenCalledOnce();
        expect(ctx.json).not.toHaveBeenCalled();

        // Sanity-check: hard-cancel (DELETE) still blocked for non-admin
        const deleteCtx = {
            ...ctx,
            req: {
                method: 'DELETE',
                path: '/api/v1/protected/billing/subscriptions/sub_abc'
            }
        };
        const next2 = vi.fn().mockResolvedValue(undefined);
        await middleware(deleteCtx as never, next2);
        expect(next2).not.toHaveBeenCalled();
        expect(deleteCtx.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'FORBIDDEN' }),
            403
        );

        // Silence the unused import warning
        void PermissionEnum;
    });
});
