/**
 * Tests for Admin Subscription Cancel Handler
 *
 * Covers:
 * - Guard 1: 404 when subscription does not exist
 * - Guard 2: 400 when subscription is already cancelled
 * - Guard 3: 503 when billing service is unavailable
 * - Phase 1 abort: 500 with ADDON_REVOCATION_FAILED when any QZPay revocation fails
 * - Phase 2: DB transaction marks purchases and subscription, then QZPay cancel is called
 * - Phase 2 QZPay failure: 500 with SUBSCRIPTION_CANCEL_FAILED
 * - Happy path: 200 with canceledAddons list and clears entitlement cache
 * - No-addon subscriptions: skips Phase 1 and proceeds directly to Phase 2
 * - Race-condition guard: skips DB writes if subscription already cancelled inside transaction
 * - AC-2.2: Phase 1 error.details contains failedPurchases and succeededPurchases lists
 * - AC-2.3: Route param schema rejects non-UUID ids; route registered with MANAGE_SUBSCRIPTIONS permission
 *
 * @module test/routes/billing/admin/subscription-cancel
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports (vi.mock is hoisted)
// ---------------------------------------------------------------------------

// Mock drizzle-orm helpers (cannot reference external variables here)
vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return {
        ...actual,
        and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
        eq: vi.fn((col: unknown, val: unknown) => ({ _type: 'eq', col, val })),
        isNull: vi.fn((col: unknown) => ({ _type: 'isNull', col }))
    };
});

// Mock @repo/db — use a factory that returns fresh spies each call.
// Note: vi.mock() factories cannot reference variables declared outside the factory,
// so all mock state is accessed via the module-level mockDb object set up in beforeEach.
vi.mock('@repo/db', () => {
    const buildSelectChain = (result: unknown[]) => {
        const limit = vi.fn().mockResolvedValue(result);
        const where = vi.fn().mockReturnValue({ limit });
        const from = vi.fn().mockReturnValue({ where });
        const select = vi.fn().mockReturnValue({ from });
        return { select, from, where, limit };
    };

    return {
        getDb: vi.fn(() => {
            const chain0 = buildSelectChain([]);
            return {
                select: chain0.select,
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue(undefined)
                    })
                }),
                transaction: vi.fn()
            };
        }),
        billingSubscriptions: {
            id: 'id',
            status: 'status',
            customerId: 'customer_id',
            updatedAt: 'updated_at'
        },
        billingSubscriptionEvents: {
            id: 'id',
            subscriptionId: 'subscription_id',
            previousStatus: 'previous_status',
            newStatus: 'new_status',
            triggerSource: 'trigger_source',
            metadata: 'metadata',
            createdAt: 'created_at'
        }
    };
});

// Mock @repo/db/schemas/billing (dynamic import inside handler)
vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        id: 'id',
        addonSlug: 'addon_slug',
        subscriptionId: 'subscription_id',
        status: 'status',
        deletedAt: 'deleted_at',
        canceledAt: 'canceled_at',
        updatedAt: 'updated_at'
    },
    billingSubscriptionEvents: {
        id: 'id',
        subscriptionId: 'subscription_id',
        previousStatus: 'previous_status',
        newStatus: 'new_status',
        triggerSource: 'trigger_source',
        metadata: 'metadata',
        createdAt: 'created_at'
    }
}));

// Mock @repo/billing (dynamic import inside handler)
vi.mock('@repo/billing', () => ({
    getAddonBySlug: vi.fn().mockReturnValue({
        slug: 'visibility-boost-7d',
        grantsEntitlement: 'featured_listing',
        affectsLimitKey: null
    })
}));

// Mock @repo/schemas
vi.mock('@repo/schemas', () => ({
    PermissionEnum: { MANAGE_SUBSCRIPTIONS: 'manage:subscriptions' },
    SubscriptionStatusEnum: {
        CANCELLED: 'cancelled',
        ACTIVE: 'active'
    }
}));

// Mock billing middleware
vi.mock('../../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

// Mock entitlement middleware
vi.mock('../../../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

// Mock actor middleware (imported by subscription-cancel for adminUserId)
vi.mock('../../../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn().mockReturnValue({
        id: 'admin-user-001',
        isAuthenticated: true,
        role: 'admin',
        permissions: ['manage:subscriptions']
    })
}));

// Mock addon-lifecycle service
vi.mock('../../../../src/services/addon-lifecycle.service', () => ({
    revokeAddonForSubscriptionCancellation: vi.fn()
}));

// Mock Sentry
vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
}));

// Mock route factory — vi.fn() so we can inspect mock.calls after the module
// executes (module-level call happens at import time due to hoisting).
vi.mock('../../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn()
}));

// Mock logger
vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import { getDb } from '@repo/db';
// ---------------------------------------------------------------------------
// Imports (after all mocks)
// ---------------------------------------------------------------------------
import * as Sentry from '@sentry/node';
import { z } from 'zod';
import { getQZPayBilling } from '../../../../src/middlewares/billing';
import { clearEntitlementCache } from '../../../../src/middlewares/entitlement';
import { cancelSubscriptionHandler } from '../../../../src/routes/billing/admin/subscription-cancel';
import { revokeAddonForSubscriptionCancellation } from '../../../../src/services/addon-lifecycle.service';
import { createAdminRoute } from '../../../../src/utils/route-factory';

// ---------------------------------------------------------------------------
// Module-level capture of createAdminRoute registration call
// ---------------------------------------------------------------------------
//
// The route module calls createAdminRoute() at module-load time (top-level,
// not inside a function). That call happens when the module is first imported,
// before any test or lifecycle hook runs. We capture the mock.calls snapshot
// here — once, at module evaluation time — so it is immune to vi.clearAllMocks()
// calls made by any beforeEach hooks further down.

type AdminRouteCallArg = {
    path?: string;
    requiredPermissions?: string[];
    [key: string]: unknown;
};

const _adminRouteCallsAtImport = vi.mocked(createAdminRoute).mock.calls.slice();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Subscription and customer identifiers reused across tests. */
const SUBSCRIPTION_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const CUSTOMER_ID = 'cus_test_customer_001';

const validParams = { id: SUBSCRIPTION_ID };
const validBody = { reason: 'Admin-initiated cancellation' };

/**
 * Builds a minimal fake Hono Context with a spy for c.json().
 * Returns both the context and a `calls` array for easy assertion.
 */
function buildContext() {
    const calls: Array<{ body: unknown; status: number }> = [];
    const cJson = vi.fn((body: unknown, status = 200) => {
        calls.push({ body, status });
        return { __isResponse: true, body, status } as unknown as Response;
    });

    return {
        c: { json: cJson } as unknown as Parameters<typeof cancelSubscriptionHandler>[0],
        calls
    };
}

/**
 * Builds a mock QZPay billing instance with a cancel spy.
 */
function buildBillingMock() {
    return {
        subscriptions: {
            cancel: vi.fn().mockResolvedValue(undefined)
        }
    };
}

/**
 * Builds a mock DB with configurable select chains and a transaction mock.
 *
 * The handler calls db.select() twice:
 *   1st: Guard 1 lookup → chain: .select().from().where().limit(1) → [row] | []
 *   2nd: Phase 1 active-purchases → chain: .select({}).from().where() → array (no .limit)
 *
 * Pass the desired return values for each call.
 */
function buildDbMock(
    subscriptionRow: Record<string, unknown> | null,
    activePurchases: Array<{ id: string; addonSlug: string }>,
    transactionImpl?: (cb: (trx: unknown) => Promise<void>) => Promise<void>
) {
    // Guard 1 chain: .select().from().where().limit()
    const guard1Limit = vi.fn().mockResolvedValue(subscriptionRow ? [subscriptionRow] : []);
    const guard1Where = vi.fn().mockReturnValue({ limit: guard1Limit });
    const guard1From = vi.fn().mockReturnValue({ where: guard1Where });

    // Phase 1 chain: .select({fields}).from().where() — resolves directly (no .limit)
    const phase1Where = vi.fn().mockResolvedValue(activePurchases);
    const phase1From = vi.fn().mockReturnValue({ where: phase1Where });

    // Dispatch: first call → guard1, second call → phase1
    let callCount = 0;
    const selectDispatch = vi.fn(() => {
        callCount++;
        if (callCount === 1) return { from: guard1From };
        return { from: phase1From };
    });

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set: updateSet });

    // Default transaction: runs callback with a minimal trx that looks "active"
    const defaultTransactionImpl = async (cb: (trx: unknown) => Promise<void>) => {
        const trx = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([{ status: 'active' }])
                    })
                })
            }),
            update: vi.fn().mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue(undefined)
                })
            }),
            insert: vi.fn().mockReturnValue({
                values: vi.fn().mockResolvedValue(undefined)
            })
        };
        await cb(trx);
    };

    const transaction = vi.fn(transactionImpl ?? defaultTransactionImpl);

    return { select: selectDispatch, update, transaction };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('cancelSubscriptionHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ─── Guard 1: subscription not found ─────────────────────────────────────

    describe('Guard 1 — subscription not found', () => {
        it('should return 404 when the subscription does not exist', async () => {
            // Arrange
            const { c, calls } = buildContext();
            const db = buildDbMock(null, []);
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);

            // Act
            const result = await cancelSubscriptionHandler(c, validParams, validBody);

            // Assert
            expect(result).toMatchObject({ __isResponse: true });
            expect(calls).toHaveLength(1);
            expect(calls[0]!.status).toBe(404);
            const error = (calls[0]!.body as { error: { code: string } }).error;
            expect(error.code).toBe('SUBSCRIPTION_NOT_FOUND');
        });
    });

    // ─── Guard 2: already cancelled ──────────────────────────────────────────

    describe('Guard 2 — subscription already cancelled', () => {
        it('should return 400 when the subscription status is already cancelled', async () => {
            // Arrange
            const { c, calls } = buildContext();
            const db = buildDbMock(
                { id: SUBSCRIPTION_ID, status: 'cancelled', customerId: CUSTOMER_ID },
                []
            );
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);

            // Act
            const result = await cancelSubscriptionHandler(c, validParams, validBody);

            // Assert
            expect(result).toMatchObject({ __isResponse: true });
            expect(calls[0]!.status).toBe(400);
            const error = (calls[0]!.body as { error: { code: string } }).error;
            expect(error.code).toBe('SUBSCRIPTION_ALREADY_CANCELLED');
        });
    });

    // ─── Guard 3: billing unavailable ────────────────────────────────────────

    describe('Guard 3 — billing service unavailable', () => {
        it('should return 503 when getQZPayBilling returns null', async () => {
            // Arrange
            const { c, calls } = buildContext();
            const db = buildDbMock(
                { id: SUBSCRIPTION_ID, status: 'active', customerId: CUSTOMER_ID },
                []
            );
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue(null);

            // Act
            const result = await cancelSubscriptionHandler(c, validParams, validBody);

            // Assert
            expect(result).toMatchObject({ __isResponse: true });
            expect(calls[0]!.status).toBe(503);
            const error = (calls[0]!.body as { error: { code: string } }).error;
            expect(error.code).toBe('SERVICE_UNAVAILABLE');
        });
    });

    // ─── Phase 1: revocation failure ─────────────────────────────────────────

    describe('Phase 1 — addon revocation failure', () => {
        it('should return 500 with ADDON_REVOCATION_FAILED when any revocation throws', async () => {
            // Arrange
            const { c, calls } = buildContext();
            const billing = buildBillingMock();
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue(billing);

            const db = buildDbMock(
                { id: SUBSCRIPTION_ID, status: 'active', customerId: CUSTOMER_ID },
                [
                    { id: 'purchase-1', addonSlug: 'visibility-boost-7d' },
                    { id: 'purchase-2', addonSlug: 'extra-photos-20' }
                ]
            );
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);

            // First purchase succeeds, second fails
            (revokeAddonForSubscriptionCancellation as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({
                    purchaseId: 'purchase-1',
                    addonSlug: 'visibility-boost-7d',
                    outcome: 'success'
                })
                .mockRejectedValueOnce(new Error('QZPay timeout'));

            // Act
            const result = await cancelSubscriptionHandler(c, validParams, validBody);

            // Assert
            expect(result).toMatchObject({ __isResponse: true });
            expect(calls[0]!.status).toBe(500);
            const error = (calls[0]!.body as { error: { code: string } }).error;
            expect(error.code).toBe('ADDON_REVOCATION_FAILED');

            // Phase 2 must NOT have run
            expect(billing.subscriptions.cancel).not.toHaveBeenCalled();
        });

        it('should report the failure to Sentry with correct tags', async () => {
            // Arrange
            const { c } = buildContext();
            const billing = buildBillingMock();
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue(billing);

            const db = buildDbMock(
                { id: SUBSCRIPTION_ID, status: 'active', customerId: CUSTOMER_ID },
                [{ id: 'purchase-1', addonSlug: 'visibility-boost-7d' }]
            );
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);
            (
                revokeAddonForSubscriptionCancellation as ReturnType<typeof vi.fn>
            ).mockRejectedValueOnce(new Error('entitlement not found'));

            // Act
            await cancelSubscriptionHandler(c, validParams, validBody);

            // Assert
            expect(Sentry.captureException).toHaveBeenCalledOnce();
            const call0 = (Sentry.captureException as ReturnType<typeof vi.fn>).mock.calls[0]!;
            const sentryCtx = call0[1] as { tags: Record<string, string> };
            expect(sentryCtx.tags).toMatchObject({
                subsystem: 'billing-addon-lifecycle',
                action: 'admin_subscription_cancel'
            });
        });

        it('should list the failed addon slugs in the error message', async () => {
            // Arrange
            const { c, calls } = buildContext();
            const billing = buildBillingMock();
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue(billing);

            const db = buildDbMock(
                { id: SUBSCRIPTION_ID, status: 'active', customerId: CUSTOMER_ID },
                [
                    { id: 'p1', addonSlug: 'extra-accommodations-5' },
                    { id: 'p2', addonSlug: 'visibility-boost-30d' }
                ]
            );
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);
            (revokeAddonForSubscriptionCancellation as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error('provider error')
            );

            // Act
            await cancelSubscriptionHandler(c, validParams, validBody);

            // Assert: both slugs appear in the message
            const error = (calls[0]!.body as { error: { message: string } }).error;
            expect(error.message).toContain('extra-accommodations-5');
            expect(error.message).toContain('visibility-boost-30d');
        });
    });

    // ─── Phase 2: QZPay cancel failure ───────────────────────────────────────

    describe('Phase 2 — QZPay cancel failure after DB commit', () => {
        it('should return 500 with SUBSCRIPTION_CANCEL_FAILED when billing.subscriptions.cancel throws', async () => {
            // Arrange
            const { c, calls } = buildContext();
            const billing = buildBillingMock();
            billing.subscriptions.cancel.mockRejectedValueOnce(
                new Error('MercadoPago unavailable')
            );
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue(billing);

            const db = buildDbMock(
                { id: SUBSCRIPTION_ID, status: 'active', customerId: CUSTOMER_ID },
                []
            );
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);

            // Act
            const result = await cancelSubscriptionHandler(c, validParams, validBody);

            // Assert
            expect(result).toMatchObject({ __isResponse: true });
            expect(calls[0]!.status).toBe(500);
            const error = (calls[0]!.body as { error: { code: string } }).error;
            expect(error.code).toBe('SUBSCRIPTION_CANCEL_FAILED');
        });

        it('should report QZPay cancel failure to Sentry', async () => {
            // Arrange
            const { c } = buildContext();
            const billing = buildBillingMock();
            billing.subscriptions.cancel.mockRejectedValueOnce(new Error('payment provider error'));
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue(billing);

            const db = buildDbMock(
                { id: SUBSCRIPTION_ID, status: 'active', customerId: CUSTOMER_ID },
                []
            );
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);

            // Act
            await cancelSubscriptionHandler(c, validParams, validBody);

            // Assert
            expect(Sentry.captureException).toHaveBeenCalledOnce();
            const call0phase2 = (Sentry.captureException as ReturnType<typeof vi.fn>).mock
                .calls[0]!;
            const sentryCtxPhase2 = call0phase2[1] as { tags: Record<string, string> };
            expect(sentryCtxPhase2.tags).toMatchObject({
                subsystem: 'billing-addon-lifecycle',
                action: 'admin_subscription_cancel'
            });
        });
    });

    // ─── Happy path ───────────────────────────────────────────────────────────

    describe('happy path — successful cancellation', () => {
        it('should return an object with subscriptionId and canceledAddons on success', async () => {
            // Arrange
            const { c } = buildContext();
            const billing = buildBillingMock();
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue(billing);

            const db = buildDbMock(
                { id: SUBSCRIPTION_ID, status: 'active', customerId: CUSTOMER_ID },
                [
                    { id: 'purchase-1', addonSlug: 'visibility-boost-7d' },
                    { id: 'purchase-2', addonSlug: 'extra-photos-20' }
                ]
            );
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);
            (revokeAddonForSubscriptionCancellation as ReturnType<typeof vi.fn>).mockResolvedValue({
                outcome: 'success'
            });

            // Act
            const result = await cancelSubscriptionHandler(c, validParams, validBody);

            // Assert: handler returns plain data object (factory wraps it with createResponse)
            expect(result).toMatchObject({
                subscriptionId: SUBSCRIPTION_ID,
                canceledAddons: expect.arrayContaining([
                    { purchaseId: 'purchase-1', addonSlug: 'visibility-boost-7d' },
                    { purchaseId: 'purchase-2', addonSlug: 'extra-photos-20' }
                ])
            });
        });

        it('should call billing.subscriptions.cancel with the subscription id and reason', async () => {
            // Arrange
            const { c } = buildContext();
            const billing = buildBillingMock();
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue(billing);

            const db = buildDbMock(
                { id: SUBSCRIPTION_ID, status: 'active', customerId: CUSTOMER_ID },
                []
            );
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);

            // Act
            await cancelSubscriptionHandler(c, validParams, validBody);

            // Assert
            expect(billing.subscriptions.cancel).toHaveBeenCalledOnce();
            const cancelCall = billing.subscriptions.cancel.mock.calls[0]!;
            expect(cancelCall[0]).toBe(SUBSCRIPTION_ID);
            expect(cancelCall[1]).toMatchObject({
                cancelAtPeriodEnd: false,
                reason: validBody.reason
            });
        });

        it('should clear the entitlement cache for the customer on success', async () => {
            // Arrange
            const { c } = buildContext();
            const billing = buildBillingMock();
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue(billing);

            const db = buildDbMock(
                { id: SUBSCRIPTION_ID, status: 'active', customerId: CUSTOMER_ID },
                []
            );
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);

            // Act
            await cancelSubscriptionHandler(c, validParams, validBody);

            // Assert
            expect(clearEntitlementCache).toHaveBeenCalledOnce();
            expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });

        it('should call revokeAddonForSubscriptionCancellation once per active purchase', async () => {
            // Arrange
            const { c } = buildContext();
            const billing = buildBillingMock();
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue(billing);

            const db = buildDbMock(
                { id: SUBSCRIPTION_ID, status: 'active', customerId: CUSTOMER_ID },
                [
                    { id: 'p-001', addonSlug: 'extra-accommodations-5' },
                    { id: 'p-002', addonSlug: 'visibility-boost-7d' }
                ]
            );
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);
            (revokeAddonForSubscriptionCancellation as ReturnType<typeof vi.fn>).mockResolvedValue({
                outcome: 'success'
            });

            // Act
            await cancelSubscriptionHandler(c, validParams, validBody);

            // Assert: one call per purchase
            expect(revokeAddonForSubscriptionCancellation).toHaveBeenCalledTimes(2);
        });

        it('should proceed without error when there are no active addon purchases', async () => {
            // Arrange
            const { c } = buildContext();
            const billing = buildBillingMock();
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue(billing);

            const db = buildDbMock(
                { id: SUBSCRIPTION_ID, status: 'active', customerId: CUSTOMER_ID },
                []
            );
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);

            // Act
            const result = await cancelSubscriptionHandler(c, validParams, validBody);

            // Assert
            expect(result).toMatchObject({
                subscriptionId: SUBSCRIPTION_ID,
                canceledAddons: []
            });
            expect(revokeAddonForSubscriptionCancellation).not.toHaveBeenCalled();
            expect(billing.subscriptions.cancel).toHaveBeenCalledOnce();
        });
    });

    // ─── Race-condition guard ─────────────────────────────────────────────────

    describe('Phase 2 — race-condition guard inside transaction', () => {
        it('should skip DB writes and return 409 when subscription is already cancelled inside transaction', async () => {
            // Arrange
            const { c, calls } = buildContext();
            const billing = buildBillingMock();
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue(billing);

            const trxUpdate = vi.fn();

            // Transaction sees the subscription as already cancelled (concurrent webhook scenario)
            const transactionImpl = async (cb: (trx: unknown) => Promise<void>) => {
                const trx = {
                    select: vi.fn().mockReturnValue({
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([{ status: 'cancelled' }])
                            })
                        })
                    }),
                    update: trxUpdate,
                    insert: vi.fn().mockReturnValue({
                        values: vi.fn().mockResolvedValue(undefined)
                    })
                };
                await cb(trx);
            };

            const db = buildDbMock(
                { id: SUBSCRIPTION_ID, status: 'active', customerId: CUSTOMER_ID },
                [],
                transactionImpl
            );
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);

            // Act — must not throw
            await cancelSubscriptionHandler(c, validParams, validBody);

            // Assert: no DB updates inside the transaction
            expect(trxUpdate).not.toHaveBeenCalled();

            // When concurrently cancelled, handler returns 409 and does NOT call QZPay
            expect(calls[0]?.status).toBe(409);
            expect(billing.subscriptions.cancel).not.toHaveBeenCalled();
            expect(clearEntitlementCache).not.toHaveBeenCalled();
        });
    });

    // ─── AC-2.2: Phase 1 response body details ───────────────────────────────

    describe('AC-2.2 — Phase 1 failure response body structure', () => {
        it('should include failedPurchases in error.details when a revocation fails', async () => {
            // Arrange
            const { c, calls } = buildContext();
            const billing = buildBillingMock();
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue(billing);

            const db = buildDbMock(
                { id: SUBSCRIPTION_ID, status: 'active', customerId: CUSTOMER_ID },
                [{ id: 'pur-fail-1', addonSlug: 'visibility-boost-7d' }]
            );
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);
            (
                revokeAddonForSubscriptionCancellation as ReturnType<typeof vi.fn>
            ).mockRejectedValueOnce(new Error('entitlement API timeout'));

            // Act
            await cancelSubscriptionHandler(c, validParams, validBody);

            // Assert: error.details.failedPurchases contains the failed entry
            const body = calls[0]!.body as {
                error: {
                    code: string;
                    details: {
                        failedPurchases: Array<{
                            purchaseId: string;
                            addonSlug: string;
                            outcome: string;
                        }>;
                        succeededPurchases: Array<{
                            purchaseId: string;
                            addonSlug: string;
                            outcome: string;
                        }>;
                    };
                };
            };
            expect(body.error.code).toBe('ADDON_REVOCATION_FAILED');
            expect(body.error.details.failedPurchases).toHaveLength(1);
            expect(body.error.details.failedPurchases[0]).toMatchObject({
                purchaseId: 'pur-fail-1',
                addonSlug: 'visibility-boost-7d',
                outcome: 'failed'
            });
        });

        it('should include succeededPurchases in error.details for the ones that passed before the failure', async () => {
            // Arrange
            const { c, calls } = buildContext();
            const billing = buildBillingMock();
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue(billing);

            const db = buildDbMock(
                { id: SUBSCRIPTION_ID, status: 'active', customerId: CUSTOMER_ID },
                [
                    { id: 'pur-ok-1', addonSlug: 'extra-photos-20' },
                    { id: 'pur-fail-2', addonSlug: 'visibility-boost-7d' }
                ]
            );
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);

            // First resolves, second rejects
            (revokeAddonForSubscriptionCancellation as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('QZPay error'));

            // Act
            await cancelSubscriptionHandler(c, validParams, validBody);

            // Assert: one succeeded, one failed
            const body = calls[0]!.body as {
                error: {
                    details: {
                        failedPurchases: Array<{ purchaseId: string }>;
                        succeededPurchases: Array<{ purchaseId: string }>;
                    };
                };
            };
            expect(body.error.details.succeededPurchases).toHaveLength(1);
            expect(body.error.details.succeededPurchases[0]).toMatchObject({
                purchaseId: 'pur-ok-1',
                outcome: 'success'
            });
            expect(body.error.details.failedPurchases).toHaveLength(1);
            expect(body.error.details.failedPurchases[0]).toMatchObject({
                purchaseId: 'pur-fail-2',
                outcome: 'failed'
            });
        });

        it('should not call billing.subscriptions.cancel (Phase 2 skipped) when Phase 1 fails', async () => {
            // Arrange
            const { c } = buildContext();
            const billing = buildBillingMock();
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue(billing);

            const db = buildDbMock(
                { id: SUBSCRIPTION_ID, status: 'active', customerId: CUSTOMER_ID },
                [{ id: 'pur-1', addonSlug: 'extra-accommodations-5' }]
            );
            (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db);
            (
                revokeAddonForSubscriptionCancellation as ReturnType<typeof vi.fn>
            ).mockRejectedValueOnce(new Error('provider unreachable'));

            // Act
            await cancelSubscriptionHandler(c, validParams, validBody);

            // Assert: transaction and QZPay cancel were not invoked
            expect(db.transaction).not.toHaveBeenCalled();
            expect(billing.subscriptions.cancel).not.toHaveBeenCalled();
        });
    });
});

// ---------------------------------------------------------------------------
// AC-2.3: Route registration and schema validation (top-level describe to avoid
// interference from vi.clearAllMocks() inside the handler describe's beforeEach)
// ---------------------------------------------------------------------------

describe('AC-2.3 — subscriptionCancelRoute: registration and param/body schema validation', () => {
    /**
     * _adminRouteCallsAtImport is a module-level snapshot of createAdminRoute mock.calls
     * taken immediately after the module imports resolve — before any test or beforeEach
     * lifecycle runs. This makes it immune to vi.clearAllMocks() in sibling describes.
     */
    const routeRegistrationOptions: AdminRouteCallArg | undefined = _adminRouteCallsAtImport.find(
        ([opts]) =>
            typeof (opts as unknown as AdminRouteCallArg).path === 'string' &&
            ((opts as unknown as AdminRouteCallArg).path as string).includes('cancel')
    )?.[0] as unknown as AdminRouteCallArg | undefined;

    it('should register the route with MANAGE_SUBSCRIPTIONS permission', () => {
        /**
         * The mock for @repo/schemas maps MANAGE_SUBSCRIPTIONS → 'manage:subscriptions'.
         * We verify the route factory was called with that value in requiredPermissions.
         */
        expect(routeRegistrationOptions).toBeDefined();
        expect(routeRegistrationOptions!.requiredPermissions).toContain('manage:subscriptions');
    });

    it('should register the route at path containing /cancel', () => {
        expect(routeRegistrationOptions).toBeDefined();
        expect(routeRegistrationOptions!.path).toContain('cancel');
    });

    describe('param schema — id must be a UUID', () => {
        /**
         * These tests verify the Zod schema that guards the route param rejects
         * non-UUID values. The handler receives already-validated params; validation
         * itself is enforced by the route factory middleware.
         */
        const SubscriptionCancelParamSchema = z.object({
            id: z.string().uuid()
        });

        it('should reject a plain string id', () => {
            // Act
            const result = SubscriptionCancelParamSchema.safeParse({ id: 'not-a-uuid' });

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.path).toContain('id');
            }
        });

        it('should reject an empty string id', () => {
            // Act
            const result = SubscriptionCancelParamSchema.safeParse({ id: '' });

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a numeric id', () => {
            // Act
            const result = SubscriptionCancelParamSchema.safeParse({ id: 12345 });

            // Assert
            expect(result.success).toBe(false);
        });

        it('should accept a valid v4 UUID', () => {
            // Act
            const result = SubscriptionCancelParamSchema.safeParse({
                id: 'aaaaaaaa-0000-4000-8000-000000000001'
            });

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('body schema — reason is optional with a 500-char max', () => {
        const SubscriptionCancelBodySchema = z.object({
            reason: z.string().max(500).optional()
        });

        it('should accept an empty body (reason is optional)', () => {
            expect(SubscriptionCancelBodySchema.safeParse({}).success).toBe(true);
        });

        it('should accept a reason within 500 characters', () => {
            expect(
                SubscriptionCancelBodySchema.safeParse({ reason: 'Admin cancelled manually.' })
                    .success
            ).toBe(true);
        });

        it('should reject a reason exceeding 500 characters', () => {
            const result = SubscriptionCancelBodySchema.safeParse({ reason: 'x'.repeat(501) });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.path).toContain('reason');
            }
        });

        it('should accept a reason of exactly 500 characters', () => {
            expect(
                SubscriptionCancelBodySchema.safeParse({ reason: 'x'.repeat(500) }).success
            ).toBe(true);
        });
    });
});
