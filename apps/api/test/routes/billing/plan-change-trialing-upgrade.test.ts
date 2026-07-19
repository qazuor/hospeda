/**
 * Unit tests for the HOS-211 trialing-upgrade branch of `handlePlanChange`.
 *
 * Owner decision under test: upgrading plans WHILE a subscription is
 * `trialing` must apply the new plan immediately with NO charge (no
 * Checkout Pro), by mutating the live MP preapproval's `transaction_amount`
 * instead. See `apps/api/src/services/billing/trialing-plan-upgrade.service.ts`
 * for the full mechanism/fail-closed contract.
 *
 * Covers:
 * - Happy path: `billing.checkout.create` / `initiatePaidPlanUpgrade` are
 *   NEVER reached; the MP preapproval is mutated to the new (higher) amount;
 *   the plan is applied locally with `prorationBehavior: 'none'`; the
 *   entitlement cache is cleared; trial/status fields are never written.
 * - Fail-closed: an MP mutation rejection leaves the local subscription on
 *   the old plan (no `changePlan` call, no cache clear) and surfaces 502.
 * - Companion: an `active` (non-trial) upgrade is unaffected — it still
 *   goes through `initiatePaidPlanUpgrade` / Checkout Pro.
 *
 * @module test/routes/billing/plan-change-trialing-upgrade
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must be declared BEFORE importing the route file).
// ---------------------------------------------------------------------------

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
    billingMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../../src/utils/route-factory', () => ({
    createSimpleRoute: vi.fn((config: { handler: unknown }) => config.handler),
    createAdminRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../../src/utils/audit-logger', () => ({
    auditLog: vi.fn(),
    AuditEventType: { BILLING_MUTATION: 'billing.mutation' }
}));

vi.mock('../../../src/services/addon-plan-change.service', () => ({
    handlePlanChangeAddonRecalculation: vi.fn().mockResolvedValue(undefined)
}));

// The full restoration/featured-sync chain is skipped by returning `null`
// from resolveOwnerUserId (mirrors the "could not resolve owner" branch in
// both confirmPlanUpgrade and applyTrialingPlanUpgrade) — this test suite
// only asserts on the no-charge / fail-closed contract, not the downstream
// best-effort restoration steps (those are covered by payment-logic.test.ts
// for the sibling paid-upgrade flow, and the two flows share the exact same
// restoration call).
vi.mock('../../../src/services/subscription-pause.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        resolveOwnerUserId: vi.fn().mockResolvedValue(null)
    };
});

vi.mock('../../../src/utils/env', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA'
    }
}));

vi.mock('../../../src/services/subscription-checkout.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        initiatePaidPlanUpgrade: vi.fn()
    };
});

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        getDb: vi.fn(() => ({ insert: vi.fn().mockReturnValue({ values: vi.fn() }) })),
        billingSubscriptionEvents: { __table: 'billing_subscription_events' }
    };
});

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { getQZPayBilling } from '../../../src/middlewares/billing';
import { clearEntitlementCache } from '../../../src/middlewares/entitlement';
import { handlePlanChange } from '../../../src/routes/billing/plan-change';
import { initiatePaidPlanUpgrade } from '../../../src/services/subscription-checkout.service';
import { apiLogger } from '../../../src/utils/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_owner';
const SUB_ID = 'sub_trialing_1';
const MP_SUBSCRIPTION_ID = 'mp_preapproval_1';
const CURRENT_PLAN_ID = 'plan_plus';
const TARGET_PLAN_ID = 'plan_vip';
const CURRENT_PRICE_CENTAVOS = 100_000; // $1000 ARS
const TARGET_PRICE_CENTAVOS = 200_000; // $2000 ARS

function makeContext(body: unknown = { newPlanId: TARGET_PLAN_ID, billingInterval: 'monthly' }) {
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ['billingCustomerId', CUSTOMER_ID],
        ['actor', { id: '00000000-0000-4000-8000-000000000002', role: 'USER', permissions: [] }]
    ]);
    return {
        get: vi.fn((k: string) => store.get(k)),
        req: { json: vi.fn().mockResolvedValue(body) }
    };
}

function makePlansMock() {
    return vi.fn().mockImplementation((id: string) => {
        if (id === CURRENT_PLAN_ID) {
            return Promise.resolve({
                id: CURRENT_PLAN_ID,
                prices: [
                    {
                        id: 'price_plus',
                        billingInterval: 'month',
                        unitAmount: CURRENT_PRICE_CENTAVOS,
                        intervalCount: 1
                    }
                ]
            });
        }
        return Promise.resolve({
            id: TARGET_PLAN_ID,
            prices: [
                {
                    id: 'price_vip',
                    billingInterval: 'month',
                    unitAmount: TARGET_PRICE_CENTAVOS,
                    intervalCount: 1
                }
            ]
        });
    });
}

/**
 * Builds a QZPayBilling mock representing a `trialing` subscription about
 * to be upgraded. `mpUpdateImpl` lets individual tests override the MP
 * preapproval-mutation outcome (e.g. to simulate a rejection).
 */
function makeTrialingBillingMock(mpUpdateImpl?: () => Promise<void>) {
    const activeSub = {
        id: SUB_ID,
        planId: CURRENT_PLAN_ID,
        status: 'trialing',
        interval: 'month',
        intervalCount: 1,
        cancelAtPeriodEnd: false,
        providerSubscriptionIds: { mercadopago: MP_SUBSCRIPTION_ID }
    };
    const changedSubscription = {
        ...activeSub,
        planId: TARGET_PLAN_ID,
        customerId: CUSTOMER_ID
    };

    const checkoutCreate = vi.fn();
    const changePlan = vi.fn().mockResolvedValue({
        subscription: changedSubscription,
        proration: null
    });
    const mpUpdate = vi.fn().mockImplementation(mpUpdateImpl ?? (async () => undefined));
    const paymentAdapter = { subscriptions: { update: mpUpdate } };

    const billing = {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([activeSub]),
            // Read by clearPendingScheduledPlanChange — no schedule pending.
            get: vi.fn().mockResolvedValue({ ...activeSub, scheduledPlanChange: null }),
            update: vi.fn(),
            changePlan
        },
        plans: { get: makePlansMock() },
        checkout: { create: checkoutCreate },
        getPaymentAdapter: vi.fn(() => paymentAdapter)
    };

    return { billing, checkoutCreate, changePlan, mpUpdate };
}

function mockBilling(billing: unknown) {
    vi.mocked(getQZPayBilling).mockReturnValue(billing as ReturnType<typeof getQZPayBilling>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handlePlanChange — HOS-211 trialing-upgrade branch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('applies the new plan with no charge and preserves the trial', async () => {
        const { billing, checkoutCreate, changePlan, mpUpdate } = makeTrialingBillingMock();
        mockBilling(billing);

        const ctx = makeContext();
        const result = await handlePlanChange(ctx as never);

        expect(result).toEqual({
            status: 'active',
            subscriptionId: SUB_ID,
            previousPlanId: CURRENT_PLAN_ID,
            newPlanId: TARGET_PLAN_ID,
            effectiveAt: expect.any(String)
        });

        // (i) never reaches the Checkout Pro / paid-upgrade path.
        expect(checkoutCreate).not.toHaveBeenCalled();
        expect(initiatePaidPlanUpgrade).not.toHaveBeenCalled();

        // (ii) MP preapproval mutated to the new plan + the new (higher)
        // major-unit amount. `planId` is REQUIRED here (unlike the same-plan
        // discount mutation this mechanism was originally modeled on) because
        // this is a cross-plan operation — mirrors the two existing
        // cross-plan precedents (confirmPlanUpgrade, apply-scheduled-plan-changes).
        expect(mpUpdate).toHaveBeenCalledWith(MP_SUBSCRIPTION_ID, {
            planId: TARGET_PLAN_ID,
            transactionAmount: TARGET_PRICE_CENTAVOS / 100
        });

        // (iii) plan applied locally with no proration; entitlement cache cleared.
        expect(changePlan).toHaveBeenCalledWith(SUB_ID, {
            newPlanId: TARGET_PLAN_ID,
            newPriceId: 'price_vip',
            prorationBehavior: 'none',
            applyAt: 'immediately'
        });
        expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);

        // (iv) trial window / status are never part of the write — the only
        // field this flow ever changes is planId (via changePlan above).
        const changePlanArgs = changePlan.mock.calls[0]?.[1];
        expect(changePlanArgs).not.toHaveProperty('trialEnd');
        expect(changePlanArgs).not.toHaveProperty('status');
        expect(changePlanArgs).not.toHaveProperty('currentPeriodEnd');
    });

    it('fails closed: an MP rejection leaves the plan unchanged and surfaces 502', async () => {
        const { billing, changePlan, checkoutCreate } = makeTrialingBillingMock(async () => {
            throw new Error('MP rejected the amount change');
        });
        mockBilling(billing);

        const ctx = makeContext();
        await expect(handlePlanChange(ctx as never)).rejects.toMatchObject({ status: 502 });

        // Fail-closed contract: no local write, no cache invalidation, and
        // the paid-upgrade path was never attempted either.
        expect(changePlan).not.toHaveBeenCalled();
        expect(clearEntitlementCache).not.toHaveBeenCalled();
        expect(checkoutCreate).not.toHaveBeenCalled();
    });

    it('fails closed when the trialing subscription has no linked MP preapproval', async () => {
        const { billing, changePlan } = makeTrialingBillingMock();
        // Simulate a trialing row with no live preapproval id at all.
        billing.subscriptions.getByCustomerId = vi.fn().mockResolvedValue([
            {
                id: SUB_ID,
                planId: CURRENT_PLAN_ID,
                status: 'trialing',
                interval: 'month',
                intervalCount: 1,
                cancelAtPeriodEnd: false,
                providerSubscriptionIds: {}
            }
        ]);
        mockBilling(billing);

        const ctx = makeContext();
        await expect(handlePlanChange(ctx as never)).rejects.toMatchObject({ status: 502 });
        expect(changePlan).not.toHaveBeenCalled();
    });

    // CRITICAL 1 (judgment-day fix): the MP mutation succeeding is NOT the
    // end of the story — if the local `changePlan` commit fails AFTER that,
    // MP is left charging the new price at trial end while the local plan
    // never moved. This must surface as a DISTINCT, loud, paged error —
    // never conflated with "MP rejected the mutation" (which is safe).
    it('fails loud (not closed) when MP mutation succeeds but the local changePlan commit fails — drift state', async () => {
        const { billing, changePlan, mpUpdate } = makeTrialingBillingMock();
        changePlan.mockRejectedValueOnce(new Error('DB connection lost mid-commit'));
        mockBilling(billing);

        const ctx = makeContext();
        await expect(handlePlanChange(ctx as never)).rejects.toMatchObject({ status: 500 });

        // The MP mutation DID go through — this is the drift condition,
        // distinct from the fail-closed MP-reject case above.
        expect(mpUpdate).toHaveBeenCalledWith(MP_SUBSCRIPTION_ID, {
            planId: TARGET_PLAN_ID,
            transactionAmount: TARGET_PRICE_CENTAVOS / 100
        });
        expect(changePlan).toHaveBeenCalled();
        // The commit never landed, so the entitlement cache must not be
        // cleared for a plan change that never actually applied locally.
        expect(clearEntitlementCache).not.toHaveBeenCalled();

        // Explicit "manual reconcile required" drift log, paged via the
        // codebase's { capture: true } Sentry-forwarding convention.
        expect(apiLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                subscriptionId: SUB_ID,
                mpSubscriptionId: MP_SUBSCRIPTION_ID,
                oldPlanId: CURRENT_PLAN_ID,
                newPlanId: TARGET_PLAN_ID
            }),
            expect.stringContaining('manual reconcile required'),
            { capture: true }
        );
    });
});

// WARNING 3 (judgment-day fix): a same-plan, different-INTERVAL change (e.g.
// monthly → annual on the same tier) can reach the trialing-upgrade branch
// as an "upgrade" — the idempotency guard must NOT swallow it just because
// `oldPlanId === newPlanId`.
describe('handlePlanChange — HOS-211 WARNING 3: same-plan cycle change is not swallowed', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('applies a same-plan monthly-to-annual cycle change instead of no-op-ing', async () => {
        const MONTHLY_PRICE_ID = 'price_plus_monthly';
        const ANNUAL_PRICE_ID = 'price_plus_annual';
        const ANNUAL_PRICE_CENTAVOS = 1_000_000; // far above the monthly price → isUpgrade

        const activeSub = {
            id: SUB_ID,
            planId: CURRENT_PLAN_ID,
            status: 'trialing',
            interval: 'month',
            intervalCount: 1,
            cancelAtPeriodEnd: false,
            providerSubscriptionIds: { mercadopago: MP_SUBSCRIPTION_ID }
        };
        const changedSubscription = { ...activeSub, customerId: CUSTOMER_ID };
        const checkoutCreate = vi.fn();
        const changePlan = vi
            .fn()
            .mockResolvedValue({ subscription: changedSubscription, proration: null });
        const mpUpdate = vi.fn().mockResolvedValue(undefined);
        const billing = {
            subscriptions: {
                getByCustomerId: vi.fn().mockResolvedValue([activeSub]),
                get: vi.fn().mockResolvedValue({ ...activeSub, scheduledPlanChange: null }),
                update: vi.fn(),
                changePlan
            },
            // Same plan id resolves for BOTH the current and target lookups —
            // it carries both a monthly and an annual price.
            plans: {
                get: vi.fn().mockResolvedValue({
                    id: CURRENT_PLAN_ID,
                    prices: [
                        {
                            id: MONTHLY_PRICE_ID,
                            billingInterval: 'month',
                            unitAmount: CURRENT_PRICE_CENTAVOS,
                            intervalCount: 1
                        },
                        {
                            id: ANNUAL_PRICE_ID,
                            billingInterval: 'year',
                            unitAmount: ANNUAL_PRICE_CENTAVOS,
                            intervalCount: 1
                        }
                    ]
                })
            },
            checkout: { create: checkoutCreate },
            getPaymentAdapter: vi.fn(() => ({ subscriptions: { update: mpUpdate } }))
        };
        mockBilling(billing);

        const ctx = makeContext({ newPlanId: CURRENT_PLAN_ID, billingInterval: 'annual' });
        const result = await handlePlanChange(ctx as never);

        expect(result).toMatchObject({
            status: 'active',
            subscriptionId: SUB_ID,
            previousPlanId: CURRENT_PLAN_ID,
            newPlanId: CURRENT_PLAN_ID
        });

        // NOT swallowed as an idempotent no-op: both the MP mutation and the
        // local changePlan commit actually ran, moving the price/interval.
        expect(mpUpdate).toHaveBeenCalledWith(MP_SUBSCRIPTION_ID, {
            planId: CURRENT_PLAN_ID,
            transactionAmount: ANNUAL_PRICE_CENTAVOS / 100
        });
        expect(changePlan).toHaveBeenCalledWith(SUB_ID, {
            newPlanId: CURRENT_PLAN_ID,
            newPriceId: ANNUAL_PRICE_ID,
            prorationBehavior: 'none',
            applyAt: 'immediately'
        });
        expect(checkoutCreate).not.toHaveBeenCalled();
    });
});

describe('handlePlanChange — companion: active (non-trial) upgrade is unaffected', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('routes an active subscription through initiatePaidPlanUpgrade / Checkout Pro, not the trialing branch', async () => {
        const { billing, checkoutCreate } = makeTrialingBillingMock();
        billing.subscriptions.getByCustomerId = vi.fn().mockResolvedValue([
            {
                id: SUB_ID,
                planId: CURRENT_PLAN_ID,
                status: 'active',
                interval: 'month',
                intervalCount: 1,
                cancelAtPeriodEnd: false,
                providerSubscriptionIds: { mercadopago: MP_SUBSCRIPTION_ID }
            }
        ]);
        mockBilling(billing);
        vi.mocked(initiatePaidPlanUpgrade).mockResolvedValue({
            checkoutUrl: 'https://mp.test/checkout/active-upgrade',
            localSubscriptionId: SUB_ID,
            expiresAt: '2026-08-01T00:00:00.000Z',
            newPlanId: TARGET_PLAN_ID,
            deltaCentavos: 100_000
        });

        const ctx = makeContext();
        const result = await handlePlanChange(ctx as never);

        expect(result).toMatchObject({ status: 'pending_payment', newPlanId: TARGET_PLAN_ID });
        expect(initiatePaidPlanUpgrade).toHaveBeenCalled();
        // Never reaches the trialing mutate-preapproval path.
        expect(checkoutCreate).not.toHaveBeenCalled();
    });
});
