/**
 * Unit tests for the HOS-222 cross-category classification of `handlePlanChange`.
 *
 * The bug: the engine classified upgrade-vs-downgrade purely by PRICE, so an
 * equal-priced `tourist-vip` → `owner-basico` move (a genuine cross-tier
 * UPGRADE) fell into the downgrade branch and was rejected HTTP 422.
 *
 * The fix routes by CATEGORY RANK: a move to a higher-ranked category applies
 * immediately regardless of price. This suite pins the routing decisions and
 * mocks the leaf services (each has its own unit tests):
 *  - `applyImmediatePaidPlanSwap` (equal/cheaper cross-category on an ACTIVE sub)
 *  - `applyTrialingPlanUpgrade` (any immediate change on a TRIALING sub)
 *  - `initiatePaidPlanUpgrade` (strictly-dearer change)
 *  - `scheduleSubscriptionDowngrade` (same-category cheaper, or rank-DOWN)
 *
 * @module test/routes/billing/plan-change-cross-category
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (declared before importing the route file).
// ---------------------------------------------------------------------------

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
    billingMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
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

vi.mock('../../../src/utils/audit-logger', () => ({
    auditLog: vi.fn(),
    AuditEventType: { BILLING_MUTATION: 'billing.mutation' }
}));

vi.mock('../../../src/utils/env', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA'
    }
}));

vi.mock('../../../src/utils/notification-helper', () => ({ sendNotification: vi.fn() }));

vi.mock('../../../src/services/billing/immediate-plan-swap.service', () => ({
    applyImmediatePaidPlanSwap: vi.fn()
}));

vi.mock('../../../src/services/billing/trialing-plan-upgrade.service', () => ({
    applyTrialingPlanUpgrade: vi.fn()
}));

vi.mock('../../../src/services/subscription-checkout.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, initiatePaidPlanUpgrade: vi.fn() };
});

vi.mock('../../../src/services/subscription-downgrade.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, scheduleSubscriptionDowngrade: vi.fn() };
});

vi.mock('../../../src/services/subscription-downgrade-excess.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        computeDowngradeExcess: vi.fn().mockResolvedValue(undefined),
        defaultExcessDeps: {}
    };
});

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { getQZPayBilling } from '../../../src/middlewares/billing';
import { handlePlanChange } from '../../../src/routes/billing/plan-change';
import { applyImmediatePaidPlanSwap } from '../../../src/services/billing/immediate-plan-swap.service';
import { applyTrialingPlanUpgrade } from '../../../src/services/billing/trialing-plan-upgrade.service';
import { initiatePaidPlanUpgrade } from '../../../src/services/subscription-checkout.service';
import { scheduleSubscriptionDowngrade } from '../../../src/services/subscription-downgrade.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_1';
const SUB_ID = 'sub_1';
const CURRENT_PLAN_ID = 'plan_tourist_vip';
const TARGET_PLAN_ID = 'plan_owner_basico';
const MP_SUB_ID = 'mp_1';
const PRICE_15K = 1_500_000; // $15.000 ARS in centavos
// Price-row ids produced by `makeBilling` below. Pinned in the money-arg
// assertions so a future edit that swaps current/target (or drops `/100`) fails.
const CURRENT_PRICE_ID = 'price_current';
const TARGET_PRICE_ID = 'price_target';

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

interface PlanSetup {
    readonly currentCategory?: string;
    readonly targetCategory?: string;
    readonly currentPriceCentavos: number;
    readonly targetPriceCentavos: number;
    readonly status?: 'active' | 'trialing';
}

function makeBilling(setup: PlanSetup) {
    const activeSub = {
        id: SUB_ID,
        planId: CURRENT_PLAN_ID,
        status: setup.status ?? 'active',
        interval: 'month',
        intervalCount: 1,
        cancelAtPeriodEnd: false,
        providerSubscriptionIds: { mercadopago: MP_SUB_ID }
    };
    const plansGet = vi.fn().mockImplementation((id: string) => {
        if (id === CURRENT_PLAN_ID) {
            return Promise.resolve({
                id: CURRENT_PLAN_ID,
                name: 'tourist-vip',
                active: true,
                ...(setup.currentCategory ? { metadata: { category: setup.currentCategory } } : {}),
                prices: [
                    {
                        id: 'price_current',
                        billingInterval: 'month',
                        unitAmount: setup.currentPriceCentavos,
                        intervalCount: 1,
                        active: true
                    }
                ]
            });
        }
        return Promise.resolve({
            id: TARGET_PLAN_ID,
            name: 'owner-basico',
            active: true,
            ...(setup.targetCategory ? { metadata: { category: setup.targetCategory } } : {}),
            prices: [
                {
                    id: 'price_target',
                    billingInterval: 'month',
                    unitAmount: setup.targetPriceCentavos,
                    intervalCount: 1,
                    active: true
                }
            ]
        });
    });
    const billing = {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([activeSub]),
            get: vi.fn().mockResolvedValue({ ...activeSub, scheduledPlanChange: null }),
            update: vi.fn()
        },
        plans: { get: plansGet },
        getPaymentAdapter: vi.fn(() => ({ subscriptions: { update: vi.fn() } }))
    };
    return billing;
}

function mockBilling(billing: unknown) {
    vi.mocked(getQZPayBilling).mockReturnValue(billing as ReturnType<typeof getQZPayBilling>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handlePlanChange — HOS-222 cross-category classification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(applyImmediatePaidPlanSwap).mockResolvedValue({
            subscriptionId: SUB_ID,
            previousPlanId: CURRENT_PLAN_ID,
            newPlanId: TARGET_PLAN_ID
        });
        vi.mocked(applyTrialingPlanUpgrade).mockResolvedValue({
            subscriptionId: SUB_ID,
            previousPlanId: CURRENT_PLAN_ID,
            newPlanId: TARGET_PLAN_ID,
            alreadyOnTargetPlan: false
        });
        vi.mocked(scheduleSubscriptionDowngrade).mockResolvedValue({
            subscriptionId: SUB_ID,
            previousPlanId: CURRENT_PLAN_ID,
            newPlanId: TARGET_PLAN_ID,
            applyAt: '2026-08-01T00:00:00.000Z',
            replacedPriorSchedule: false
        });
    });

    it('EQUAL-price rank-UP on an ACTIVE sub applies immediately (the bug: no more 422)', async () => {
        // tourist-vip ($15.000) → owner-basico ($15.000): equal price, rank UP.
        const billing = makeBilling({
            currentCategory: 'tourist',
            targetCategory: 'owner',
            currentPriceCentavos: PRICE_15K,
            targetPriceCentavos: PRICE_15K,
            status: 'active'
        });
        mockBilling(billing);

        const result = await handlePlanChange(makeContext() as never);

        expect(result).toMatchObject({ status: 'active', subscriptionId: SUB_ID });
        // Pin the money args: the swap MUST receive the TARGET price id (not the
        // current one) and the TARGET amount converted centavos→major (`/100`).
        // A future edit swapping current/target or dropping `/100` fails here.
        expect(applyImmediatePaidPlanSwap).toHaveBeenCalledWith(
            expect.objectContaining({
                subscriptionId: SUB_ID,
                oldPlanId: CURRENT_PLAN_ID,
                newPlanId: TARGET_PLAN_ID,
                newPriceId: TARGET_PRICE_ID,
                targetTransactionAmountMajor: PRICE_15K / 100,
                mpSubscriptionId: MP_SUB_ID
            })
        );
        expect(scheduleSubscriptionDowngrade).not.toHaveBeenCalled();
        expect(initiatePaidPlanUpgrade).not.toHaveBeenCalled();
    });

    it('CHEAPER rank-UP on an ACTIVE sub also swaps immediately (no charge)', async () => {
        const billing = makeBilling({
            currentCategory: 'tourist',
            targetCategory: 'owner',
            currentPriceCentavos: PRICE_15K,
            targetPriceCentavos: 1_000_000,
            status: 'active'
        });
        mockBilling(billing);

        const result = await handlePlanChange(makeContext() as never);

        expect(result).toMatchObject({ status: 'active' });
        // Cheaper target: the swap still carries the TARGET (lower) amount, not
        // the current one — the whole point of a no-charge lateral/cheaper swap.
        expect(applyImmediatePaidPlanSwap).toHaveBeenCalledWith(
            expect.objectContaining({
                newPlanId: TARGET_PLAN_ID,
                newPriceId: TARGET_PRICE_ID,
                targetTransactionAmountMajor: 1_000_000 / 100
            })
        );
        expect(scheduleSubscriptionDowngrade).not.toHaveBeenCalled();
    });

    it('EQUAL-price rank-UP while TRIALING routes to the trialing upgrade (trial preserved)', async () => {
        const billing = makeBilling({
            currentCategory: 'tourist',
            targetCategory: 'owner',
            currentPriceCentavos: PRICE_15K,
            targetPriceCentavos: PRICE_15K,
            status: 'trialing'
        });
        mockBilling(billing);

        const result = await handlePlanChange(makeContext() as never);

        expect(result).toMatchObject({ status: 'active' });
        // Pin the money args on the trialing path too: the TARGET plan/price/amount
        // (and the current price id used for the idempotency guard) flow through.
        expect(applyTrialingPlanUpgrade).toHaveBeenCalledWith(
            expect.objectContaining({
                subscriptionId: SUB_ID,
                oldPlanId: CURRENT_PLAN_ID,
                newPlanId: TARGET_PLAN_ID,
                newPriceId: TARGET_PRICE_ID,
                currentPriceId: CURRENT_PRICE_ID,
                targetTransactionAmountMajor: PRICE_15K / 100,
                mpSubscriptionId: MP_SUB_ID
            })
        );
        expect(applyImmediatePaidPlanSwap).not.toHaveBeenCalled();
        expect(scheduleSubscriptionDowngrade).not.toHaveBeenCalled();
    });

    it('DEARER rank-UP on an ACTIVE sub uses the prorated paid-upgrade flow', async () => {
        vi.mocked(initiatePaidPlanUpgrade).mockResolvedValue({
            checkoutUrl: 'https://mp.test/checkout',
            localSubscriptionId: SUB_ID,
            expiresAt: '2026-08-01T00:00:00.000Z',
            newPlanId: TARGET_PLAN_ID,
            deltaCentavos: 500_000
        });
        const billing = makeBilling({
            currentCategory: 'tourist',
            targetCategory: 'owner',
            currentPriceCentavos: PRICE_15K,
            targetPriceCentavos: 2_000_000,
            status: 'active'
        });
        mockBilling(billing);

        const result = await handlePlanChange(makeContext() as never);

        expect(result).toMatchObject({ status: 'pending_payment' });
        // The prorated-upgrade service re-resolves the price internally, so only
        // the TARGET plan id + billing interval flow in — pin those so a
        // current/target swap or an interval bug fails the test. (The prorated
        // amount is asserted in `subscription-checkout.service` unit tests.)
        expect(initiatePaidPlanUpgrade).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: CUSTOMER_ID,
                currentSubscriptionId: SUB_ID,
                newPlanId: TARGET_PLAN_ID,
                billingInterval: 'month',
                intervalCount: 1
            })
        );
        expect(applyImmediatePaidPlanSwap).not.toHaveBeenCalled();
    });

    it('SAME-category cheaper change stays a scheduled downgrade', async () => {
        const billing = makeBilling({
            currentCategory: 'tourist',
            targetCategory: 'tourist',
            currentPriceCentavos: PRICE_15K,
            targetPriceCentavos: 500_000,
            status: 'active'
        });
        mockBilling(billing);

        const result = await handlePlanChange(makeContext() as never);

        expect(result).toMatchObject({ status: 'scheduled' });
        expect(scheduleSubscriptionDowngrade).toHaveBeenCalledTimes(1);
        expect(applyImmediatePaidPlanSwap).not.toHaveBeenCalled();
        expect(initiatePaidPlanUpgrade).not.toHaveBeenCalled();
    });

    it('rank-DOWN cross-category cheaper change stays a scheduled downgrade (not forced immediate)', async () => {
        // owner → tourist, cheaper.
        const billing = makeBilling({
            currentCategory: 'owner',
            targetCategory: 'tourist',
            currentPriceCentavos: PRICE_15K,
            targetPriceCentavos: 500_000,
            status: 'active'
        });
        mockBilling(billing);

        const result = await handlePlanChange(makeContext() as never);

        expect(result).toMatchObject({ status: 'scheduled' });
        expect(scheduleSubscriptionDowngrade).toHaveBeenCalledTimes(1);
        expect(applyImmediatePaidPlanSwap).not.toHaveBeenCalled();
    });

    it('with NO category metadata, falls back to price logic (equal price → downgrade, unchanged)', async () => {
        const billing = makeBilling({
            currentPriceCentavos: PRICE_15K,
            targetPriceCentavos: PRICE_15K,
            status: 'active'
        });
        mockBilling(billing);

        const result = await handlePlanChange(makeContext() as never);

        // Equal price + unknown categories → still classified as a downgrade
        // (behavior unchanged for plans without a category).
        expect(result).toMatchObject({ status: 'scheduled' });
        expect(applyImmediatePaidPlanSwap).not.toHaveBeenCalled();
    });

    // W1 — cross-category rank-UP that ALSO changes billing interval
    // (monthly → annual). The route compares prices RAW per interval-unit (it
    // divides only by `intervalCount`, NOT across month↔year), so this fixture
    // makes the ANNUAL target's raw amount equal to the current monthly amount
    // → not an upgrade by price → cross-category rank-up → immediate swap.
    //
    // The point of the case is to pin that the ANNUAL target price row (id +
    // amount), NOT the current MONTHLY one, flows into the swap. The MP cadence
    // change itself (monthly preapproval → annual 12-month preapproval) is
    // validated by the staging MP-sandbox smoke gate (W1) — the payment adapter
    // is mocked here, so this asserts only the routing + money args.
    it('monthly → annual cross-category rank-UP routes to the swap with the ANNUAL price row', async () => {
        const ANNUAL_PRICE_ID = 'price_target_annual';
        const ANNUAL_AMOUNT_CENTAVOS = PRICE_15K; // equal raw → lands on the swap path

        const activeSub = {
            id: SUB_ID,
            planId: CURRENT_PLAN_ID,
            status: 'active' as const,
            interval: 'month',
            intervalCount: 1,
            cancelAtPeriodEnd: false,
            providerSubscriptionIds: { mercadopago: MP_SUB_ID }
        };
        const plansGet = vi.fn().mockImplementation((id: string) => {
            if (id === CURRENT_PLAN_ID) {
                return Promise.resolve({
                    id: CURRENT_PLAN_ID,
                    name: 'tourist-vip',
                    active: true,
                    metadata: { category: 'tourist' },
                    prices: [
                        {
                            id: CURRENT_PRICE_ID,
                            billingInterval: 'month',
                            unitAmount: PRICE_15K,
                            intervalCount: 1,
                            active: true
                        }
                    ]
                });
            }
            return Promise.resolve({
                id: TARGET_PLAN_ID,
                name: 'owner-basico',
                active: true,
                metadata: { category: 'owner' },
                prices: [
                    {
                        id: ANNUAL_PRICE_ID,
                        billingInterval: 'year',
                        unitAmount: ANNUAL_AMOUNT_CENTAVOS,
                        intervalCount: 1,
                        active: true
                    }
                ]
            });
        });
        const billing = {
            subscriptions: {
                getByCustomerId: vi.fn().mockResolvedValue([activeSub]),
                get: vi.fn().mockResolvedValue({ ...activeSub, scheduledPlanChange: null }),
                update: vi.fn()
            },
            plans: { get: plansGet },
            getPaymentAdapter: vi.fn(() => ({ subscriptions: { update: vi.fn() } }))
        };
        mockBilling(billing);

        const result = await handlePlanChange(
            makeContext({ newPlanId: TARGET_PLAN_ID, billingInterval: 'annual' }) as never
        );

        expect(result).toMatchObject({ status: 'active' });
        expect(applyImmediatePaidPlanSwap).toHaveBeenCalledWith(
            expect.objectContaining({
                newPlanId: TARGET_PLAN_ID,
                // the ANNUAL price row, NOT the current monthly one
                newPriceId: ANNUAL_PRICE_ID,
                targetTransactionAmountMajor: ANNUAL_AMOUNT_CENTAVOS / 100,
                mpSubscriptionId: MP_SUB_ID
            })
        );
        expect(initiatePaidPlanUpgrade).not.toHaveBeenCalled();
        expect(scheduleSubscriptionDowngrade).not.toHaveBeenCalled();
    });

    it('DEARER rank-UP while TRIALING still routes to the trialing upgrade (dearer amount, no charge)', async () => {
        const DEARER_CENTAVOS = 2_000_000; // owner target dearer than the tourist current
        const billing = makeBilling({
            currentCategory: 'tourist',
            targetCategory: 'owner',
            currentPriceCentavos: PRICE_15K,
            targetPriceCentavos: DEARER_CENTAVOS,
            status: 'trialing'
        });
        mockBilling(billing);

        const result = await handlePlanChange(makeContext() as never);

        expect(result).toMatchObject({ status: 'active' });
        // Trialing upgrade preserves the trial (no charge) and carries the
        // DEARER target amount — the first charge at trial end bills the new price.
        expect(applyTrialingPlanUpgrade).toHaveBeenCalledWith(
            expect.objectContaining({
                newPlanId: TARGET_PLAN_ID,
                newPriceId: TARGET_PRICE_ID,
                targetTransactionAmountMajor: DEARER_CENTAVOS / 100
            })
        );
        expect(applyImmediatePaidPlanSwap).not.toHaveBeenCalled();
        expect(initiatePaidPlanUpgrade).not.toHaveBeenCalled();
    });
});
