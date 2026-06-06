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
        previousStatus: 'previous_status',
        newStatus: 'new_status',
        triggerSource: 'trigger_source',
        eventType: 'event_type',
        metadata: 'metadata',
        createdAt: 'created_at'
    },
    billingSubscriptions: {
        id: 'id',
        customerId: 'customer_id',
        status: 'status'
    }
}));

// importOriginal spread preserves all enum/type exports that are transitively
// needed by @repo/service-core (e.g. PermissionEnum used in permission.ts).
vi.mock('@repo/schemas', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/schemas')>();
    return {
        ...actual,
        SubscriptionStatusEnum: {
            CANCELLED: 'cancelled',
            ACTIVE: 'active'
        }
    };
});

// After SPEC-192 T-017 cutover, qzpay-admin-hooks.ts imports AddonCatalogService.
// PlanService is also needed for the transitive addon-plan-change.service import.
// SPEC-194 T-006/T-007: importOriginal spread preserves pure functions like
// checkSubscriptionStatusTransition while still overriding class-based exports.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AddonCatalogService: vi.fn().mockImplementation(() => ({
            getBySlug: vi.fn().mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'addon not found' }
            }),
            list: vi.fn()
        })),
        PlanService: vi.fn().mockImplementation(() => ({
            getById: vi.fn(),
            getBySlug: vi.fn()
        })),
        BILLING_EVENT_TYPES: {
            ADDON_REVOCATIONS_PENDING: 'ADDON_REVOCATIONS_PENDING'
        }
    };
});

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

// SPEC-194 T-006/T-007: refund lifecycle service — mocked so hook tests can
// verify delegation. The service itself is unit-tested in refund-lifecycle.service.test.ts.
vi.mock('../../../../../src/services/refund-lifecycle.service', () => ({
    applyRefundLifecycle: vi.fn().mockResolvedValue(undefined)
}));

// SPEC-167 T-014: downgrade restriction + upgrade restoration mocks.
vi.mock('../../../../../src/services/plan-downgrade-remediation.service', () => ({
    applyDowngradeRestrictionsOrWarn: vi.fn().mockResolvedValue({
        restricted: { accommodations: [], promotions: [], photosByAccommodation: {} },
        keptBySelection: { accommodations: [], promotions: [] },
        keptByDefault: { accommodations: [], promotions: [] },
        grandfatherFlags: []
    })
}));

vi.mock('../../../../../src/services/plan-upgrade-restoration.service', () => ({
    applyUpgradeRestorationsOrWarn: vi.fn().mockResolvedValue({
        restored: { accommodations: [], promotions: [], photosByAccommodation: {} },
        stillRestricted: { accommodations: [], promotions: [] }
    })
}));

vi.mock('../../../../../src/services/subscription-pause.service', () => ({
    resolveOwnerUserId: vi.fn().mockResolvedValue('owner-user-001'),
    setOwnerServiceSuspension: vi.fn().mockResolvedValue({ accommodationsUpdated: 0 })
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
import { applyDowngradeRestrictionsOrWarn } from '../../../../../src/services/plan-downgrade-remediation.service';
import { applyUpgradeRestorationsOrWarn } from '../../../../../src/services/plan-upgrade-restoration.service';
import { applyRefundLifecycle } from '../../../../../src/services/refund-lifecycle.service';
import { resolveOwnerUserId } from '../../../../../src/services/subscription-pause.service';

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
    opts: {
        activePurchases?: Array<{ id: string; addonSlug: string; customerId: string }>;
        subscriptionStatus?: string;
    } = {}
) {
    const activePurchases = opts.activePurchases ?? [];
    const subscriptionStatus = opts.subscriptionStatus ?? 'active';

    // onBeforeSubscriptionCancel issues TWO selects: first the live-status
    // guard query (returns the subscription's current status), then the active
    // addon-purchases query. Resolve them in that order. Other hooks issue no
    // select, so the leading once() value is simply never consumed there.
    const selectWhere = vi
        .fn()
        .mockResolvedValueOnce([{ status: subscriptionStatus }])
        .mockResolvedValue(activePurchases);
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
 * Build a minimal QZPayPayment fixture as expected by `onAfterPaymentRefund`.
 * `subscriptionId` defaults to SUBSCRIPTION_ID so refund lifecycle applies.
 * Set `subscriptionId: null` to simulate a payment not linked to a subscription.
 */
function buildPayment(
    overrides: Partial<{
        id: string;
        customerId: string;
        amount: number;
        status: string;
        subscriptionId: string | null;
    }> = {}
) {
    return {
        id: PAYMENT_ID,
        customerId: CUSTOMER_ID,
        amount: 1000,
        status: 'refunded',
        subscriptionId: SUBSCRIPTION_ID,
        ...overrides
    } as Parameters<NonNullable<typeof adminBillingHooks.onAfterPaymentRefund>>[0]['payment'];
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

/**
 * Build a QZPay plan fixture with a single price at the given unit amount.
 * `name` is used as the plan slug by `applyDowngradeRestrictions`.
 */
function buildPlan(
    id: string,
    name: string,
    unitAmount: number,
    billingInterval: 'month' | 'year' = 'month'
) {
    return {
        id,
        name,
        prices: [
            {
                id: `price-${id}`,
                billingInterval,
                intervalCount: 1,
                unitAmount,
                active: true
            }
        ]
    };
}

/**
 * Build a billing mock that can look up plans by ID.
 *
 * Used by onAfterSubscriptionChangePlan tests that need plan price comparison
 * to determine direction (downgrade vs upgrade vs same-plan).
 */
function buildBillingMockWithPlans(planMap: Record<string, ReturnType<typeof buildPlan>>) {
    return {
        subscriptions: { cancel: vi.fn() },
        customers: { get: vi.fn() },
        plans: {
            get: vi.fn().mockImplementation(async (planId: string) => planMap[planId] ?? null)
        }
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

    it('returns { ok: false } and skips side effects when the subscription is already cancelled', async () => {
        const { db, spies } = buildDbMock({ subscriptionStatus: 'canceled' });
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        vi.mocked(getQZPayBilling).mockReturnValue(
            buildBillingMock() as unknown as ReturnType<typeof getQZPayBilling>
        );

        const result = await adminBillingHooks.onBeforeSubscriptionCancel!({
            subscriptionId: SUBSCRIPTION_ID,
            immediate: false,
            ctx: buildContext()
        });

        // Idempotency guard: the live row is already cancelled, so the hook
        // aborts (HTTP 422 upstream) before revoking addons or writing events.
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toContain('already cancelled');
        }
        expect(revokeAddonForSubscriptionCancellation).not.toHaveBeenCalled();
        expect(spies.insert).not.toHaveBeenCalled();
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

// Plan fixtures for direction-detection tests.
const PLAN_BRONZE_ID = 'plan-bronze-monthly';
const PLAN_GOLD_ID = 'plan-gold-monthly';
const PLAN_BRONZE = buildPlan(PLAN_BRONZE_ID, 'bronze', 1000); // ARS 10/mo
const PLAN_GOLD = buildPlan(PLAN_GOLD_ID, 'gold', 5000); // ARS 50/mo
// Annual variant — reserved for future interval-comparison tests.
const _PLAN_BRONZE_ANNUAL_ID = 'plan-bronze-annual';
const _PLAN_BRONZE_ANNUAL = buildPlan(_PLAN_BRONZE_ANNUAL_ID, 'bronze', 10000, 'year'); // 10000/yr

describe('adminBillingHooks.onAfterSubscriptionChangePlan', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('inserts an audit event with previousPlanId and newPlanId', async () => {
        const { db, spies } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        vi.mocked(getQZPayBilling).mockReturnValue(
            buildBillingMockWithPlans({
                [PLAN_BRONZE_ID]: PLAN_BRONZE,
                [PLAN_GOLD_ID]: PLAN_GOLD
            }) as unknown as ReturnType<typeof getQZPayBilling>
        );

        await adminBillingHooks.onAfterSubscriptionChangePlan!({
            subscription: buildSubscription({ planId: PLAN_GOLD_ID }),
            previousPlanId: PLAN_BRONZE_ID,
            newPlanId: PLAN_GOLD_ID,
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
                previousPlanId: PLAN_BRONZE_ID,
                newPlanId: PLAN_GOLD_ID
            }
        });
    });

    it('clears the entitlement cache for the customer', async () => {
        const { db } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        vi.mocked(getQZPayBilling).mockReturnValue(
            buildBillingMockWithPlans({
                [PLAN_BRONZE_ID]: PLAN_BRONZE,
                [PLAN_GOLD_ID]: PLAN_GOLD
            }) as unknown as ReturnType<typeof getQZPayBilling>
        );

        await adminBillingHooks.onAfterSubscriptionChangePlan!({
            subscription: buildSubscription({ planId: PLAN_GOLD_ID }),
            previousPlanId: PLAN_BRONZE_ID,
            newPlanId: PLAN_GOLD_ID,
            ctx: buildContext()
        });

        expect(clearEntitlementCache).toHaveBeenCalledTimes(1);
        expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
    });

    // SPEC-167 T-014 (RED): downgrade → applyDowngradeRestrictionsOrWarn called with defaults.
    it('calls applyDowngradeRestrictionsOrWarn on a downgrade (gold→bronze)', async () => {
        const { db } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        vi.mocked(getQZPayBilling).mockReturnValue(
            buildBillingMockWithPlans({
                [PLAN_GOLD_ID]: PLAN_GOLD,
                [PLAN_BRONZE_ID]: PLAN_BRONZE
            }) as unknown as ReturnType<typeof getQZPayBilling>
        );
        vi.mocked(resolveOwnerUserId).mockResolvedValue('owner-user-001');

        await adminBillingHooks.onAfterSubscriptionChangePlan!({
            subscription: buildSubscription({ planId: PLAN_BRONZE_ID }),
            previousPlanId: PLAN_GOLD_ID,
            newPlanId: PLAN_BRONZE_ID,
            ctx: buildContext()
        });

        expect(applyDowngradeRestrictionsOrWarn).toHaveBeenCalledTimes(1);
        expect(applyDowngradeRestrictionsOrWarn).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'owner-user-001',
                customerId: CUSTOMER_ID,
                targetPlanSlug: 'bronze',
                keepSelections: undefined
            })
        );
        expect(applyUpgradeRestorationsOrWarn).not.toHaveBeenCalled();
    });

    // SPEC-167 T-014 (RED): upgrade → applyUpgradeRestorationsOrWarn called.
    it('calls applyUpgradeRestorationsOrWarn on an upgrade (bronze→gold)', async () => {
        const { db } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        vi.mocked(getQZPayBilling).mockReturnValue(
            buildBillingMockWithPlans({
                [PLAN_BRONZE_ID]: PLAN_BRONZE,
                [PLAN_GOLD_ID]: PLAN_GOLD
            }) as unknown as ReturnType<typeof getQZPayBilling>
        );
        vi.mocked(resolveOwnerUserId).mockResolvedValue('owner-user-001');

        await adminBillingHooks.onAfterSubscriptionChangePlan!({
            subscription: buildSubscription({ planId: PLAN_GOLD_ID }),
            previousPlanId: PLAN_BRONZE_ID,
            newPlanId: PLAN_GOLD_ID,
            ctx: buildContext()
        });

        expect(applyUpgradeRestorationsOrWarn).toHaveBeenCalledTimes(1);
        expect(applyUpgradeRestorationsOrWarn).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'owner-user-001',
                customerId: CUSTOMER_ID,
                newPlanId: PLAN_GOLD_ID
            })
        );
        expect(applyDowngradeRestrictionsOrWarn).not.toHaveBeenCalled();
    });

    // SPEC-167 T-014 (RED): two different plans with identical prices → 'same' direction
    // → neither restriction nor restoration called, but audit log and cache clear still fire.
    it('calls neither restriction nor restoration when two different plans have identical prices', async () => {
        // A renamed plan that has the same price as bronze — admin uses it e.g. for a trial correction.
        const PLAN_BRONZE_V2_ID = 'plan-bronze-v2';
        const planBronzeV2 = buildPlan(PLAN_BRONZE_V2_ID, 'bronze-v2', 1000); // same price as bronze
        const { db } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        vi.mocked(getQZPayBilling).mockReturnValue(
            buildBillingMockWithPlans({
                [PLAN_BRONZE_ID]: PLAN_BRONZE,
                [PLAN_BRONZE_V2_ID]: planBronzeV2
            }) as unknown as ReturnType<typeof getQZPayBilling>
        );

        await adminBillingHooks.onAfterSubscriptionChangePlan!({
            subscription: buildSubscription({ planId: PLAN_BRONZE_V2_ID }),
            previousPlanId: PLAN_BRONZE_ID,
            newPlanId: PLAN_BRONZE_V2_ID,
            ctx: buildContext()
        });

        expect(applyDowngradeRestrictionsOrWarn).not.toHaveBeenCalled();
        expect(applyUpgradeRestorationsOrWarn).not.toHaveBeenCalled();
        // Audit log and cache clear still fire.
        expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
    });

    // SPEC-167 T-014 (RED): billing unavailable → remediation skipped, audit+cache still fire.
    it('skips remediation but completes audit+cache when billing is unavailable', async () => {
        const { db, spies } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        vi.mocked(getQZPayBilling).mockReturnValue(null);

        await adminBillingHooks.onAfterSubscriptionChangePlan!({
            subscription: buildSubscription(),
            previousPlanId: PLAN_GOLD_ID,
            newPlanId: PLAN_BRONZE_ID,
            ctx: buildContext()
        });

        expect(applyDowngradeRestrictionsOrWarn).not.toHaveBeenCalled();
        expect(applyUpgradeRestorationsOrWarn).not.toHaveBeenCalled();
        expect(spies.insert).toHaveBeenCalledTimes(1);
        expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
    });

    // SPEC-167 T-014 (RED): remediation before cache clear (ordering constraint).
    it('calls remediation BEFORE clearEntitlementCache (cache reflects post-remediation state)', async () => {
        const { db } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        vi.mocked(getQZPayBilling).mockReturnValue(
            buildBillingMockWithPlans({
                [PLAN_GOLD_ID]: PLAN_GOLD,
                [PLAN_BRONZE_ID]: PLAN_BRONZE
            }) as unknown as ReturnType<typeof getQZPayBilling>
        );
        vi.mocked(resolveOwnerUserId).mockResolvedValue('owner-user-001');

        const callOrder: string[] = [];
        vi.mocked(applyDowngradeRestrictionsOrWarn).mockImplementation(async () => {
            callOrder.push('restriction');
            return {
                restricted: { accommodations: [], promotions: [], photosByAccommodation: {} },
                keptBySelection: { accommodations: [], promotions: [] },
                keptByDefault: { accommodations: [], promotions: [] },
                grandfatherFlags: []
            };
        });
        vi.mocked(clearEntitlementCache).mockImplementation((_customerId: string) => {
            callOrder.push('cache-clear');
        });

        await adminBillingHooks.onAfterSubscriptionChangePlan!({
            subscription: buildSubscription({ planId: PLAN_BRONZE_ID }),
            previousPlanId: PLAN_GOLD_ID,
            newPlanId: PLAN_BRONZE_ID,
            ctx: buildContext()
        });

        const restrictionIdx = callOrder.indexOf('restriction');
        const cacheIdx = callOrder.indexOf('cache-clear');
        expect(restrictionIdx).toBeGreaterThanOrEqual(0);
        expect(cacheIdx).toBeGreaterThan(restrictionIdx);
    });

    // SPEC-167 T-014 (RED): restriction throws → hook completes, audit log written, cache cleared.
    it('completes audit log and cache clear even when applyDowngradeRestrictionsOrWarn throws', async () => {
        const { db, spies } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        vi.mocked(getQZPayBilling).mockReturnValue(
            buildBillingMockWithPlans({
                [PLAN_GOLD_ID]: PLAN_GOLD,
                [PLAN_BRONZE_ID]: PLAN_BRONZE
            }) as unknown as ReturnType<typeof getQZPayBilling>
        );
        vi.mocked(resolveOwnerUserId).mockResolvedValue('owner-user-001');
        vi.mocked(applyDowngradeRestrictionsOrWarn).mockRejectedValueOnce(
            new Error('DB transient failure')
        );

        await expect(
            adminBillingHooks.onAfterSubscriptionChangePlan!({
                subscription: buildSubscription({ planId: PLAN_BRONZE_ID }),
                previousPlanId: PLAN_GOLD_ID,
                newPlanId: PLAN_BRONZE_ID,
                ctx: buildContext()
            })
        ).resolves.toBeUndefined();

        expect(spies.insert).toHaveBeenCalledTimes(1);
        expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
    });

    // SPEC-167 T-014 (RED): same plan ID admin correction (e.g. admin re-applies same plan
    // to reset the period). Both plan fetches return the identical plan → normalized
    // amounts are equal → direction = 'same' → no remediation called.
    it('treats plan-id-to-itself as same-plan direction (no restriction or restoration)', async () => {
        const { db } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        // Both previousPlanId and newPlanId resolve to the same plan object.
        vi.mocked(getQZPayBilling).mockReturnValue(
            buildBillingMockWithPlans({
                [PLAN_BRONZE_ID]: PLAN_BRONZE
            }) as unknown as ReturnType<typeof getQZPayBilling>
        );

        await adminBillingHooks.onAfterSubscriptionChangePlan!({
            subscription: buildSubscription({ planId: PLAN_BRONZE_ID }),
            previousPlanId: PLAN_BRONZE_ID,
            newPlanId: PLAN_BRONZE_ID,
            ctx: buildContext()
        });

        // Identical plans → same direction → no remediation.
        expect(applyDowngradeRestrictionsOrWarn).not.toHaveBeenCalled();
        expect(applyUpgradeRestorationsOrWarn).not.toHaveBeenCalled();
    });

    // SPEC-167 T-014 (RED): annual→monthly for the same tier where monthly rate
    // is HIGHER (e.g. monthly=1200, annual=10000/yr=833/mo) → IS a downgrade.
    it('detects downgrade when annual→monthly and monthly normalized rate is lower', async () => {
        // Annual: 10000/yr = 833/mo; Monthly: 800/mo. Monthly is cheaper → downgrade.
        const PLAN_SILVER_CHEAP_MONTHLY_ID = 'plan-silver-cheap-monthly';
        const planSilverCheapMonthly = buildPlan(PLAN_SILVER_CHEAP_MONTHLY_ID, 'silver-cheap', 800);
        const PLAN_SILVER_ANNUAL_ID = 'plan-silver-annual';
        const planSilverAnnual = buildPlan(PLAN_SILVER_ANNUAL_ID, 'silver-annual', 10000, 'year');
        const { db } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        vi.mocked(getQZPayBilling).mockReturnValue(
            buildBillingMockWithPlans({
                [PLAN_SILVER_ANNUAL_ID]: planSilverAnnual,
                [PLAN_SILVER_CHEAP_MONTHLY_ID]: planSilverCheapMonthly
            }) as unknown as ReturnType<typeof getQZPayBilling>
        );
        vi.mocked(resolveOwnerUserId).mockResolvedValue('owner-user-001');

        await adminBillingHooks.onAfterSubscriptionChangePlan!({
            subscription: buildSubscription({ planId: PLAN_SILVER_CHEAP_MONTHLY_ID }),
            previousPlanId: PLAN_SILVER_ANNUAL_ID,
            newPlanId: PLAN_SILVER_CHEAP_MONTHLY_ID,
            ctx: buildContext()
        });

        expect(applyDowngradeRestrictionsOrWarn).toHaveBeenCalledTimes(1);
        expect(applyDowngradeRestrictionsOrWarn).toHaveBeenCalledWith(
            expect.objectContaining({ targetPlanSlug: 'silver-cheap' })
        );
    });

    // SPEC-167 T-014 (RED): resolveOwnerUserId returns null → remediation skipped but
    // hook still completes (no crash, audit log and cache clear fire).
    it('skips remediation when resolveOwnerUserId returns null but completes audit+cache', async () => {
        const { db, spies } = buildDbMock();
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        vi.mocked(getQZPayBilling).mockReturnValue(
            buildBillingMockWithPlans({
                [PLAN_GOLD_ID]: PLAN_GOLD,
                [PLAN_BRONZE_ID]: PLAN_BRONZE
            }) as unknown as ReturnType<typeof getQZPayBilling>
        );
        vi.mocked(resolveOwnerUserId).mockResolvedValue(null);

        await adminBillingHooks.onAfterSubscriptionChangePlan!({
            subscription: buildSubscription({ planId: PLAN_BRONZE_ID }),
            previousPlanId: PLAN_GOLD_ID,
            newPlanId: PLAN_BRONZE_ID,
            ctx: buildContext()
        });

        expect(applyDowngradeRestrictionsOrWarn).not.toHaveBeenCalled();
        expect(spies.insert).toHaveBeenCalledTimes(1);
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
        // Partial refund (amount: 500 < payment.amount: 1000) — breadcrumb fires
        // regardless of full/partial path.
        const payment = buildPayment({ subscriptionId: null }); // null → no lifecycle work

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

    // SPEC-194 T-006 (RED): full refund delegates to applyRefundLifecycle with
    // isFullRefund=true and the correct payment + actor context.
    it('delegates to applyRefundLifecycle with isFullRefund=true on a full refund', async () => {
        const payment = buildPayment({ amount: 1000 });

        await adminBillingHooks.onAfterPaymentRefund!({
            payment,
            // amount equal to payment.amount → full refund
            amount: 1000,
            reason: 'Chargeback',
            ctx: buildContext()
        });

        expect(applyRefundLifecycle).toHaveBeenCalledTimes(1);
        expect(applyRefundLifecycle).toHaveBeenCalledWith(
            expect.objectContaining({
                payment,
                refundAmount: 1000,
                adminUserId: ADMIN_USER_ID
            })
        );
    });

    // SPEC-194 T-006 (RED): full refund when amount is undefined (hook received
    // no explicit amount) — treated as full refund.
    it('delegates to applyRefundLifecycle with isFullRefund=true when refund amount is undefined', async () => {
        const payment = buildPayment({ amount: 2000 });

        await adminBillingHooks.onAfterPaymentRefund!({
            payment,
            amount: undefined,
            reason: 'Admin bulk refund',
            ctx: buildContext()
        });

        expect(applyRefundLifecycle).toHaveBeenCalledTimes(1);
        expect(applyRefundLifecycle).toHaveBeenCalledWith(
            expect.objectContaining({
                payment,
                refundAmount: undefined,
                adminUserId: ADMIN_USER_ID
            })
        );
    });

    // SPEC-194 T-006 (RED): partial refund delegates to applyRefundLifecycle with
    // partial amount; lifecycle service handles the audit-only path.
    it('delegates to applyRefundLifecycle with partial refundAmount on a partial refund', async () => {
        const payment = buildPayment({ amount: 1000 });

        await adminBillingHooks.onAfterPaymentRefund!({
            payment,
            amount: 400, // < 1000 → partial
            reason: 'Partial service issue',
            ctx: buildContext()
        });

        expect(applyRefundLifecycle).toHaveBeenCalledTimes(1);
        expect(applyRefundLifecycle).toHaveBeenCalledWith(
            expect.objectContaining({
                payment,
                refundAmount: 400
            })
        );
    });

    // SPEC-194 T-006 (RED): hook should NOT crash if applyRefundLifecycle throws
    // (qzpay-hono wraps after-hooks in try/catch — but we guard defensively).
    it('does not propagate errors from applyRefundLifecycle (fail-safe hook)', async () => {
        vi.mocked(applyRefundLifecycle).mockRejectedValueOnce(new Error('DB unavailable'));
        const payment = buildPayment();

        await expect(
            adminBillingHooks.onAfterPaymentRefund!({
                payment,
                amount: 1000,
                reason: 'Test',
                ctx: buildContext()
            })
        ).resolves.toBeUndefined();
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
