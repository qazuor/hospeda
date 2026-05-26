/**
 * Unit tests for the SPEC-141 D7 upgrade branch of `handlePlanChange`.
 *
 * Covers:
 * - Happy path: route delegates to `initiatePaidPlanUpgrade` and
 *   returns the `pending_payment` response shape (URL, sub id, expiresAt,
 *   newPlanId, deltaCentavos).
 * - `billing.subscriptions.changePlan` is NOT called on the upgrade
 *   path (the local subscription mutates only after the webhook fires).
 * - Service errors map to the right HTTP status codes (404 / 422 / 500).
 * - Other paths through the handler (downgrades, billingEnabled,
 *   billingCustomerId short-circuits) are covered by the existing
 *   plan-change test files — this one only exercises the upgrade branch.
 *
 * @module test/routes/billing/plan-change-upgrade
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
import { handlePlanChange } from '../../../src/routes/billing/plan-change';
import {
    SubscriptionCheckoutError,
    initiatePaidPlanUpgrade
} from '../../../src/services/subscription-checkout.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_owner';
const SUB_ID = 'sub_upgrade_1';
const CURRENT_PLAN_ID = 'plan_basic';
const TARGET_PLAN_ID = 'plan_pro';

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

function makeUpgradeBillingMock() {
    // Setup represents an UPGRADE: basic 100k → pro 200k. The route
    // determines isUpgrade and routes to `initiatePaidPlanUpgrade`,
    // which we mock directly, so `changePlan` should never be called.
    const activeSub = {
        id: SUB_ID,
        planId: CURRENT_PLAN_ID,
        status: 'active',
        interval: 'month'
    };
    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([activeSub]),
            changePlan: vi.fn() // must NOT be called
        },
        plans: {
            get: vi.fn().mockImplementation((id: string) => {
                if (id === CURRENT_PLAN_ID) {
                    return Promise.resolve({
                        id: CURRENT_PLAN_ID,
                        prices: [
                            {
                                id: 'price_basic',
                                billingInterval: 'month',
                                unitAmount: 100_000,
                                intervalCount: 1
                            }
                        ]
                    });
                }
                return Promise.resolve({
                    id: TARGET_PLAN_ID,
                    prices: [
                        {
                            id: 'price_pro',
                            billingInterval: 'month',
                            unitAmount: 200_000,
                            intervalCount: 1
                        }
                    ]
                });
            })
        },
        getPaymentAdapter: vi.fn(() => null)
    };
}

function mockBilling(billing: ReturnType<typeof makeUpgradeBillingMock>) {
    vi.mocked(getQZPayBilling).mockReturnValue(
        billing as unknown as ReturnType<typeof getQZPayBilling>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handlePlanChange — SPEC-141 D7 upgrade branch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('delegates to initiatePaidPlanUpgrade and returns pending_payment response', async () => {
        const billing = makeUpgradeBillingMock();
        mockBilling(billing);
        vi.mocked(initiatePaidPlanUpgrade).mockResolvedValue({
            checkoutUrl: 'https://mp.test/checkout/up-1',
            localSubscriptionId: SUB_ID,
            expiresAt: '2026-06-16T00:30:00.000Z',
            newPlanId: TARGET_PLAN_ID,
            deltaCentavos: 50_000
        });

        const ctx = makeContext();
        const result = await handlePlanChange(ctx as never);

        expect(result).toEqual({
            status: 'pending_payment',
            checkoutUrl: 'https://mp.test/checkout/up-1',
            localSubscriptionId: SUB_ID,
            expiresAt: '2026-06-16T00:30:00.000Z',
            newPlanId: TARGET_PLAN_ID,
            deltaCentavos: 50_000
        });
        // Legacy synchronous path must NOT run on an upgrade.
        expect(billing.subscriptions.changePlan).not.toHaveBeenCalled();
    });

    it('passes successUrl, cancelUrl, notificationUrl and statementDescriptor from env to the service', async () => {
        const billing = makeUpgradeBillingMock();
        mockBilling(billing);
        vi.mocked(initiatePaidPlanUpgrade).mockResolvedValue({
            checkoutUrl: 'https://mp.test/checkout/up-1',
            localSubscriptionId: SUB_ID,
            expiresAt: '2026-06-16T00:30:00.000Z',
            newPlanId: TARGET_PLAN_ID,
            deltaCentavos: 50_000
        });

        const ctx = makeContext();
        await handlePlanChange(ctx as never);

        const call = vi.mocked(initiatePaidPlanUpgrade).mock.calls[0]?.[0];
        expect(call?.customerId).toBe(CUSTOMER_ID);
        expect(call?.currentSubscriptionId).toBe(SUB_ID);
        expect(call?.newPlanId).toBe(TARGET_PLAN_ID);
        expect(call?.billingInterval).toBe('month');
        expect(call?.intervalCount).toBe(1);
        // Finding #8: back_urls point at the existing locale-prefixed checkout
        // pages (success/failure), not the old /billing/return.
        expect(call?.urls.successUrl).toBe(
            'https://hospeda.test/es/suscriptores/checkout/success/'
        );
        expect(call?.urls.cancelUrl).toBe('https://hospeda.test/es/suscriptores/checkout/failure/');
        expect(call?.urls.notificationUrl).toBe(
            'https://api.hospeda.test/api/v1/webhooks/mercadopago'
        );
        expect(call?.statementDescriptor).toBe('HOSPEDA');
    });

    it('returns 404 when the service throws SUBSCRIPTION_NOT_FOUND', async () => {
        mockBilling(makeUpgradeBillingMock());
        vi.mocked(initiatePaidPlanUpgrade).mockRejectedValue(
            new SubscriptionCheckoutError('SUBSCRIPTION_NOT_FOUND', 'gone')
        );

        const ctx = makeContext();
        await expect(handlePlanChange(ctx as never)).rejects.toMatchObject({ status: 404 });
    });

    it('returns 404 when the service throws NO_MATCHING_PRICE', async () => {
        mockBilling(makeUpgradeBillingMock());
        vi.mocked(initiatePaidPlanUpgrade).mockRejectedValue(
            new SubscriptionCheckoutError('NO_MATCHING_PRICE', 'no price')
        );

        const ctx = makeContext();
        await expect(handlePlanChange(ctx as never)).rejects.toMatchObject({ status: 404 });
    });

    it('returns 422 when the service throws NOT_AN_UPGRADE', async () => {
        mockBilling(makeUpgradeBillingMock());
        vi.mocked(initiatePaidPlanUpgrade).mockRejectedValue(
            new SubscriptionCheckoutError('NOT_AN_UPGRADE', 'delta <= 0')
        );

        const ctx = makeContext();
        await expect(handlePlanChange(ctx as never)).rejects.toMatchObject({ status: 422 });
    });

    it('returns 422 when the service throws SAME_PLAN', async () => {
        mockBilling(makeUpgradeBillingMock());
        vi.mocked(initiatePaidPlanUpgrade).mockRejectedValue(
            new SubscriptionCheckoutError('SAME_PLAN', 'same plan')
        );

        const ctx = makeContext();
        await expect(handlePlanChange(ctx as never)).rejects.toMatchObject({ status: 422 });
    });

    it('returns 500 when the service throws MISSING_INIT_POINT', async () => {
        mockBilling(makeUpgradeBillingMock());
        vi.mocked(initiatePaidPlanUpgrade).mockRejectedValue(
            new SubscriptionCheckoutError('MISSING_INIT_POINT', 'no init point')
        );

        const ctx = makeContext();
        await expect(handlePlanChange(ctx as never)).rejects.toMatchObject({ status: 500 });
    });

    it('non-SubscriptionCheckoutError from the service propagates and surfaces as generic 500', async () => {
        mockBilling(makeUpgradeBillingMock());
        vi.mocked(initiatePaidPlanUpgrade).mockRejectedValue(new Error('Network down'));

        const ctx = makeContext();
        await expect(handlePlanChange(ctx as never)).rejects.toMatchObject({ status: 500 });
    });
});
