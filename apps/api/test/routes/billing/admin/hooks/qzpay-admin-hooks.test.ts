/**
 * Tests for the Hospeda lifecycle hooks plugged into qzpay-hono's admin tier.
 *
 * The hooks live in `apps/api/src/routes/billing/admin/qzpay-admin-hooks.ts`
 * and replace the lifecycle that used to be in the deleted
 * `subscription-cancel.ts` route handler. The qzpay-hono package owns the
 * HTTP surface and the hook invocation contract; this suite covers ONLY the
 * Hospeda-specific side effects (addon revocation + audit log + entitlement
 * cache invalidation + Sentry breadcrumbs/captures).
 *
 * The qzpay-hono side (hook invocation order, request shape, hook-throw
 * isolation) is covered by `packages/hono/test/admin.routes.test.ts` in the
 * qzpay-hono repo.
 *
 * @module test/routes/billing/admin/hooks/qzpay-admin-hooks
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports (vi.mock is hoisted)
// ---------------------------------------------------------------------------

vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return {
        ...actual,
        and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
        eq: vi.fn((col: unknown, val: unknown) => ({ _type: 'eq', col, val })),
        isNull: vi.fn((col: unknown) => ({ _type: 'isNull', col }))
    };
});

vi.mock('@repo/db', () => ({
    getDb: vi.fn(),
    billingAddonPurchases: {
        id: 'id',
        addonSlug: 'addon_slug',
        subscriptionId: 'subscription_id',
        customerId: 'customer_id',
        status: 'status',
        deletedAt: 'deleted_at',
        canceledAt: 'canceled_at',
        updatedAt: 'updated_at'
    },
    billingSubscriptionEvents: {
        id: 'id',
        subscriptionId: 'subscription_id',
        newStatus: 'new_status',
        triggerSource: 'trigger_source',
        eventType: 'event_type',
        metadata: 'metadata',
        createdAt: 'created_at'
    }
}));

vi.mock('@repo/schemas', () => ({
    SubscriptionStatusEnum: {
        CANCELLED: 'cancelled',
        ACTIVE: 'active'
    }
}));

vi.mock('@repo/service-core', () => ({
    BILLING_EVENT_TYPES: {
        ADDON_REVOCATIONS_PENDING: 'ADDON_REVOCATIONS_PENDING'
    }
}));

vi.mock('@repo/billing', () => ({
    getAddonBySlug: vi.fn().mockReturnValue({
        slug: 'visibility-boost-7d',
        grantsEntitlement: 'featured_listing',
        affectsLimitKey: null
    })
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
    addBreadcrumb: vi.fn()
}));

vi.mock('../../../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../../../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../../../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn().mockReturnValue({
        id: 'admin-user-001',
        isAuthenticated: true,
        role: 'admin',
        permissions: ['manage:subscriptions']
    })
}));

vi.mock('../../../../../src/services/addon-lifecycle.service', () => ({
    revokeAddonForSubscriptionCancellation: vi.fn()
}));

vi.mock('../../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// ---------------------------------------------------------------------------
// Imports (after all mocks)
// ---------------------------------------------------------------------------

import { getDb } from '@repo/db';
import * as Sentry from '@sentry/node';
import { getQZPayBilling } from '../../../../../src/middlewares/billing';
import { clearEntitlementCache } from '../../../../../src/middlewares/entitlement';
import { adminBillingHooks } from '../../../../../src/routes/billing/admin/qzpay-admin-hooks';
import { revokeAddonForSubscriptionCancellation } from '../../../../../src/services/addon-lifecycle.service';

// ---------------------------------------------------------------------------
// Test fixtures + helpers
// ---------------------------------------------------------------------------

const SUBSCRIPTION_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const CUSTOMER_ID = 'cus_test_customer_001';
const ADMIN_USER_ID = 'admin-user-001';
const PAYMENT_ID = 'pay_test_payment_001';
const INVOICE_ID = 'inv_test_invoice_001';

/**
 * Minimal Hono Context stub. The hooks only use it as an argument to
 * `getActorFromContext`, which is fully mocked above, so the stub can be empty.
 */
function buildContext() {
    return {} as Parameters<
        NonNullable<typeof adminBillingHooks.onBeforeSubscriptionCancel>
    >[0]['ctx'];
}

/**
 * Mock subscription payload as it would arrive from qzpay-core after a
 * successful cancel/change-plan/extend-trial operation.
 */
function buildSubscription(overrides: Record<string, unknown> = {}) {
    return {
        id: SUBSCRIPTION_ID,
        customerId: CUSTOMER_ID,
        status: 'cancelled',
        trialEnd: undefined as Date | undefined,
        ...overrides
    } as unknown as Parameters<
        NonNullable<typeof adminBillingHooks.onAfterSubscriptionCancel>
    >[0]['subscription'];
}

/**
 * Build a drizzle-style db mock with select/insert/update spies that resolve
 * with the supplied values. Callers can introspect the returned spies to
 * assert which tables/conditions/values were used.
 */
function buildDbMock(
    opts: { activePurchases?: Array<{ id: string; addonSlug: string; customerId: string }> } = {}
) {
    const activePurchases = opts.activePurchases ?? [];

    const selectWhere = vi.fn().mockResolvedValue(activePurchases);
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    const select = vi.fn().mockReturnValue({ from: selectFrom });

    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values: insertValues });

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set: updateSet });

    return {
        db: { select, insert, update },
        spies: {
            select,
            selectFrom,
            selectWhere,
            insert,
            insertValues,
            update,
            updateSet,
            updateWhere
        }
    };
}

/**
 * Build a QZPay billing mock — only used by onBeforeSubscriptionCancel to
 * gate on `getQZPayBilling()` returning a truthy value (it's passed into
 * `revokeAddonForSubscriptionCancellation`, which is itself mocked).
 */
function buildBillingMock() {
    return {
        subscriptions: { cancel: vi.fn() },
        customers: { get: vi.fn() }
    };
}

// ---------------------------------------------------------------------------
// onBeforeSubscriptionCancel
// ---------------------------------------------------------------------------

describe('adminBillingHooks.onBeforeSubscriptionCancel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns { ok: true } when no active addons exist (no DB writes)', async () => {
        const { db, spies } = buildDbMock({ activePurchases: [] });
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        vi.mocked(getQZPayBilling).mockReturnValue(
            buildBillingMock() as unknown as ReturnType<typeof getQZPayBilling>
        );

        const result = await adminBillingHooks.onBeforeSubscriptionCancel!({
            subscriptionId: SUBSCRIPTION_ID,
            immediate: false,
            ctx: buildContext()
        });

        expect(result).toEqual({ ok: true });
        // Short-circuits: no insert call, no Sentry capture, no revocation
        expect(spies.insert).not.toHaveBeenCalled();
        expect(revokeAddonForSubscriptionCancellation).not.toHaveBeenCalled();
        expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('returns { ok: false } when QZPay billing service is unavailable', async () => {
        vi.mocked(getQZPayBilling).mockReturnValue(null);

        const result = await adminBillingHooks.onBeforeSubscriptionCancel!({
            subscriptionId: SUBSCRIPTION_ID,
            immediate: false,
            ctx: buildContext()
        });

        expect(result).toEqual({
            ok: false,
            reason: 'Billing service is not configured.'
        });
    });

    it('returns { ok: true } and writes a compensating event when all revocations succeed', async () => {
        const purchases = [
            { id: 'purchase-1', addonSlug: 'visibility-boost-7d', customerId: CUSTOMER_ID },
            { id: 'purchase-2', addonSlug: 'visibility-boost-7d', customerId: CUSTOMER_ID }
        ];
        const { db, spies } = buildDbMock({ activePurchases: purchases });
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        vi.mocked(getQZPayBilling).mockReturnValue(
            buildBillingMock() as unknown as ReturnType<typeof getQZPayBilling>
        );
        vi.mocked(revokeAddonForSubscriptionCancellation).mockResolvedValue(undefined as never);

        const result = await adminBillingHooks.onBeforeSubscriptionCancel!({
            subscriptionId: SUBSCRIPTION_ID,
            immediate: false,
            ctx: buildContext()
        });

        expect(result).toEqual({ ok: true });
        expect(revokeAddonForSubscriptionCancellation).toHaveBeenCalledTimes(2);
        expect(spies.insert).toHaveBeenCalledTimes(1);

        const eventInsertArg = vi.mocked(spies.insertValues).mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(eventInsertArg).toMatchObject({
            subscriptionId: SUBSCRIPTION_ID,
            eventType: 'ADDON_REVOCATIONS_PENDING',
            triggerSource: 'admin-cancel-compensating'
        });
        const metadata = eventInsertArg?.metadata as Record<string, unknown>;
        expect(metadata.revokedAddonPurchaseIds).toEqual(['purchase-1', 'purchase-2']);
        expect(metadata.failedAddonPurchaseIds).toEqual([]);
        expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('returns { ok: false } and captures Sentry exception when any revocation fails', async () => {
        const purchases = [
            { id: 'purchase-ok', addonSlug: 'visibility-boost-7d', customerId: CUSTOMER_ID },
            { id: 'purchase-fail', addonSlug: 'spotlight-30d', customerId: CUSTOMER_ID }
        ];
        const { db, spies } = buildDbMock({ activePurchases: purchases });
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        vi.mocked(getQZPayBilling).mockReturnValue(
            buildBillingMock() as unknown as ReturnType<typeof getQZPayBilling>
        );

        // First call succeeds, second throws — Promise.allSettled handles both.
        vi.mocked(revokeAddonForSubscriptionCancellation)
            .mockResolvedValueOnce(undefined as never)
            .mockRejectedValueOnce(new Error('QZPay revoke failed'));

        const result = await adminBillingHooks.onBeforeSubscriptionCancel!({
            subscriptionId: SUBSCRIPTION_ID,
            immediate: false,
            ctx: buildContext()
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toContain('spotlight-30d');
            expect(result.reason).toContain('Cancel aborted');
        }
        // Compensating event was still recorded — DB knows which slugs succeeded
        // and which failed so a human can reconcile.
        expect(spies.insert).toHaveBeenCalledTimes(1);
        const metadata = vi.mocked(spies.insertValues).mock.calls[0]?.[0] as {
            metadata: Record<string, unknown>;
        };
        expect(metadata.metadata.revokedAddonPurchaseIds).toEqual(['purchase-ok']);
        expect(metadata.metadata.failedAddonPurchaseIds).toEqual(['purchase-fail']);
        // Sentry was notified with the failed-purchases context
        expect(Sentry.captureException).toHaveBeenCalledTimes(1);
        const sentryCall = vi.mocked(Sentry.captureException).mock.calls[0];
        expect(sentryCall?.[1]).toMatchObject({
            tags: {
                subsystem: 'billing-addon-lifecycle',
                action: 'admin_subscription_cancel'
            }
        });
    });

    it('runs revocations in parallel (all start before any await resolves)', async () => {
        const purchases = [
            { id: 'p1', addonSlug: 'visibility-boost-7d', customerId: CUSTOMER_ID },
            { id: 'p2', addonSlug: 'visibility-boost-7d', customerId: CUSTOMER_ID },
            { id: 'p3', addonSlug: 'visibility-boost-7d', customerId: CUSTOMER_ID }
        ];
        const { db } = buildDbMock({ activePurchases: purchases });
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        vi.mocked(getQZPayBilling).mockReturnValue(
            buildBillingMock() as unknown as ReturnType<typeof getQZPayBilling>
        );

        // Track the order of call-start to assert all 3 are invoked before any resolves.
        let inFlight = 0;
        let maxInFlight = 0;
        vi.mocked(revokeAddonForSubscriptionCancellation).mockImplementation((async () => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise((resolve) => setTimeout(resolve, 5));
            inFlight--;
        }) as never);

        const result = await adminBillingHooks.onBeforeSubscriptionCancel!({
            subscriptionId: SUBSCRIPTION_ID,
            immediate: false,
            ctx: buildContext()
        });

        expect(result).toEqual({ ok: true });
        expect(maxInFlight).toBe(3);
    });
});

// ---------------------------------------------------------------------------
// onAfterSubscriptionCancel
// ---------------------------------------------------------------------------

describe('adminBillingHooks.onAfterSubscriptionCancel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('updates linked addon purchases to canceled status with canceledAt timestamp', async () => {
        const { db, spies } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        await adminBillingHooks.onAfterSubscriptionCancel!({
            subscription: buildSubscription(),
            immediate: false,
            ctx: buildContext()
        });

        expect(spies.update).toHaveBeenCalledTimes(1);
        const setArg = vi.mocked(spies.updateSet).mock.calls[0]?.[0] as Record<string, unknown>;
        expect(setArg.status).toBe('canceled');
        expect(setArg.canceledAt).toBeInstanceOf(Date);
        expect(setArg.updatedAt).toBeInstanceOf(Date);
    });

    it('inserts an audit event with adminUserId and immediate flag (immediate=true)', async () => {
        const { db, spies } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        await adminBillingHooks.onAfterSubscriptionCancel!({
            subscription: buildSubscription(),
            immediate: true,
            ctx: buildContext()
        });

        expect(spies.insert).toHaveBeenCalledTimes(1);
        const eventArg = vi.mocked(spies.insertValues).mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(eventArg).toMatchObject({
            subscriptionId: SUBSCRIPTION_ID,
            newStatus: 'cancelled',
            triggerSource: 'admin-cancel',
            metadata: { adminUserId: ADMIN_USER_ID, immediate: true }
        });
    });

    it('records immediate=false in metadata when end-of-period cancel', async () => {
        const { db, spies } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        await adminBillingHooks.onAfterSubscriptionCancel!({
            subscription: buildSubscription(),
            immediate: false,
            ctx: buildContext()
        });

        const eventArg = vi.mocked(spies.insertValues).mock.calls[0]?.[0] as {
            metadata: { immediate: boolean };
        };
        expect(eventArg.metadata.immediate).toBe(false);
    });

    it('clears the entitlement cache for the subscription customer', async () => {
        const { db } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        await adminBillingHooks.onAfterSubscriptionCancel!({
            subscription: buildSubscription(),
            immediate: false,
            ctx: buildContext()
        });

        expect(clearEntitlementCache).toHaveBeenCalledTimes(1);
        expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
    });
});

// ---------------------------------------------------------------------------
// onAfterSubscriptionChangePlan
// ---------------------------------------------------------------------------

describe('adminBillingHooks.onAfterSubscriptionChangePlan', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('inserts an audit event with previousPlanId and newPlanId', async () => {
        const { db, spies } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        await adminBillingHooks.onAfterSubscriptionChangePlan!({
            subscription: buildSubscription(),
            previousPlanId: 'plan-bronze-monthly',
            newPlanId: 'plan-gold-yearly',
            ctx: buildContext()
        });

        expect(spies.insert).toHaveBeenCalledTimes(1);
        const eventArg = vi.mocked(spies.insertValues).mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(eventArg).toMatchObject({
            subscriptionId: SUBSCRIPTION_ID,
            triggerSource: 'admin-change-plan',
            metadata: {
                adminUserId: ADMIN_USER_ID,
                previousPlanId: 'plan-bronze-monthly',
                newPlanId: 'plan-gold-yearly'
            }
        });
    });

    it('clears the entitlement cache for the customer', async () => {
        const { db } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        await adminBillingHooks.onAfterSubscriptionChangePlan!({
            subscription: buildSubscription(),
            previousPlanId: 'plan-bronze-monthly',
            newPlanId: 'plan-gold-yearly',
            ctx: buildContext()
        });

        expect(clearEntitlementCache).toHaveBeenCalledTimes(1);
        expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
    });
});

// ---------------------------------------------------------------------------
// onAfterSubscriptionTrialExtended
// ---------------------------------------------------------------------------

describe('adminBillingHooks.onAfterSubscriptionTrialExtended', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('inserts an audit event with additionalDays and the new trialEnd timestamp', async () => {
        const { db, spies } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        const newTrialEnd = new Date('2026-06-15T00:00:00.000Z');

        await adminBillingHooks.onAfterSubscriptionTrialExtended!({
            subscription: buildSubscription({ trialEnd: newTrialEnd }),
            additionalDays: 7,
            ctx: buildContext()
        });

        const eventArg = vi.mocked(spies.insertValues).mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(eventArg).toMatchObject({
            subscriptionId: SUBSCRIPTION_ID,
            triggerSource: 'admin-extend-trial',
            metadata: {
                adminUserId: ADMIN_USER_ID,
                additionalDays: 7,
                newTrialEnd: newTrialEnd.toISOString()
            }
        });
    });

    it('records newTrialEnd=null in metadata when trialEnd is undefined on the subscription', async () => {
        const { db, spies } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        await adminBillingHooks.onAfterSubscriptionTrialExtended!({
            subscription: buildSubscription({ trialEnd: undefined }),
            additionalDays: 14,
            ctx: buildContext()
        });

        const eventArg = vi.mocked(spies.insertValues).mock.calls[0]?.[0] as {
            metadata: { newTrialEnd: string | null };
        };
        expect(eventArg.metadata.newTrialEnd).toBeNull();
    });

    it('does NOT clear the entitlement cache (entitlements unchanged by a trial extension)', async () => {
        const { db } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        await adminBillingHooks.onAfterSubscriptionTrialExtended!({
            subscription: buildSubscription(),
            additionalDays: 7,
            ctx: buildContext()
        });

        expect(clearEntitlementCache).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// onAfterPaymentRefund
// ---------------------------------------------------------------------------

describe('adminBillingHooks.onAfterPaymentRefund', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('adds a Sentry breadcrumb in the billing.admin category', async () => {
        const payment = {
            id: PAYMENT_ID,
            customerId: CUSTOMER_ID,
            amount: 1000,
            status: 'refunded'
        } as Parameters<NonNullable<typeof adminBillingHooks.onAfterPaymentRefund>>[0]['payment'];

        await adminBillingHooks.onAfterPaymentRefund!({
            payment,
            amount: 500,
            reason: 'Customer requested partial refund',
            ctx: buildContext()
        });

        expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
        const breadcrumb = vi.mocked(Sentry.addBreadcrumb).mock.calls[0]?.[0];
        expect(breadcrumb).toMatchObject({
            category: 'billing.admin',
            type: 'info',
            message: 'admin_payment_refund',
            data: {
                paymentId: PAYMENT_ID,
                amount: 500,
                reason: 'Customer requested partial refund',
                adminUserId: ADMIN_USER_ID
            }
        });
    });

    it('does NOT touch the database (payments have no Hospeda-side audit table)', async () => {
        const { db, spies } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        const payment = { id: PAYMENT_ID, customerId: CUSTOMER_ID } as Parameters<
            NonNullable<typeof adminBillingHooks.onAfterPaymentRefund>
        >[0]['payment'];

        await adminBillingHooks.onAfterPaymentRefund!({
            payment,
            amount: 1000,
            reason: 'Test',
            ctx: buildContext()
        });

        // getDb may not even be called — but if it is, we never touch insert/update/select.
        expect(spies.insert).not.toHaveBeenCalled();
        expect(spies.update).not.toHaveBeenCalled();
        expect(spies.select).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// onAfterInvoicePay
// ---------------------------------------------------------------------------

describe('adminBillingHooks.onAfterInvoicePay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('completes without throwing and does not write to the database', async () => {
        const { db, spies } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        const invoice = { id: INVOICE_ID, customerId: CUSTOMER_ID } as Parameters<
            NonNullable<typeof adminBillingHooks.onAfterInvoicePay>
        >[0]['invoice'];

        await expect(
            adminBillingHooks.onAfterInvoicePay!({ invoice, ctx: buildContext() })
        ).resolves.toBeUndefined();
        expect(spies.insert).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// onAfterInvoiceVoid
// ---------------------------------------------------------------------------

describe('adminBillingHooks.onAfterInvoiceVoid', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('completes without throwing and does not write to the database', async () => {
        const { db, spies } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        const invoice = { id: INVOICE_ID, customerId: CUSTOMER_ID } as Parameters<
            NonNullable<typeof adminBillingHooks.onAfterInvoiceVoid>
        >[0]['invoice'];

        await expect(
            adminBillingHooks.onAfterInvoiceVoid!({ invoice, ctx: buildContext() })
        ).resolves.toBeUndefined();
        expect(spies.insert).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Bundle integrity
// ---------------------------------------------------------------------------

describe('adminBillingHooks bundle', () => {
    it('exports all 7 documented hooks', () => {
        expect(adminBillingHooks.onBeforeSubscriptionCancel).toBeDefined();
        expect(adminBillingHooks.onAfterSubscriptionCancel).toBeDefined();
        expect(adminBillingHooks.onAfterSubscriptionChangePlan).toBeDefined();
        expect(adminBillingHooks.onAfterSubscriptionTrialExtended).toBeDefined();
        expect(adminBillingHooks.onAfterPaymentRefund).toBeDefined();
        expect(adminBillingHooks.onAfterInvoicePay).toBeDefined();
        expect(adminBillingHooks.onAfterInvoiceVoid).toBeDefined();
    });
});
