/**
 * HOS-937 step 1 — promo-plumbing test: with the own-preapproval flag ON,
 * `initiatePaidMonthlySubscription` must forward the SAME `pendingDiscount`
 * / `pendingTrialExtension` snapshot it already computes for the OLD Path C
 * flow (see `subscription-checkout-promo-branches.test.ts`) into
 * `createOwnPreapprovalSubscription`, instead of dropping it on the floor.
 *
 * Mirrors that file's mock setup (kept minimal — ONE scenario, not the full
 * promo branch matrix, which is already covered there for the old flow) so
 * the checkout decision logic runs for real while `resolveCheckoutMpPlanId`
 * and the two subscription-materializing helpers stay mocked.
 *
 * @module test/services/subscription-checkout-own-preapproval-promo-plumbing
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveCheckoutPromoPlanMock = vi.fn();
vi.mock('../../src/services/subscription-checkout-promo.service', () => ({
    resolveCheckoutPromoPlan: (...args: unknown[]) => resolveCheckoutPromoPlanMock(...args)
}));

const resolveCheckoutMpPlanIdMock = vi.fn().mockResolvedValue('mp_plan_test');
vi.mock('../../src/services/billing/mp-plan-provisioning.service', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../src/services/billing/mp-plan-provisioning.service')
        >();
    return {
        ...actual,
        resolveCheckoutMpPlanId: (...args: unknown[]) => resolveCheckoutMpPlanIdMock(...args),
        resolveOrProvisionMpPlan: vi.fn()
    };
});

const createPendingProviderSubscriptionMock = vi.fn();
vi.mock('../../src/services/billing/pending-provider-subscription-create', () => ({
    createPendingProviderSubscription: (...args: unknown[]) =>
        createPendingProviderSubscriptionMock(...args)
}));

const createOwnPreapprovalSubscriptionMock = vi.fn();
vi.mock('../../src/services/billing/own-preapproval-subscription-create', () => ({
    createOwnPreapprovalSubscription: (...args: unknown[]) =>
        createOwnPreapprovalSubscriptionMock(...args)
}));

const calculatePromoCodeEffectMock = vi.fn();
const resolveFullPlanPriceCentavosMock = vi.fn();
const redeemAndRecordUsageMock = vi.fn();
// importActual (not a full replace): subscription-checkout.service.ts
// transitively imports symbols from '@repo/service-core' that construct
// module-level singletons at import time. Same reasoning as
// subscription-checkout-promo-branches.test.ts.
vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual('@repo/service-core');
    return {
        ...actual,
        resolveFullPlanPriceCentavos: (...args: unknown[]) =>
            resolveFullPlanPriceCentavosMock(...args),
        calculatePromoCodeEffect: (...args: unknown[]) => calculatePromoCodeEffectMock(...args),
        redeemAndRecordUsage: (...args: unknown[]) => redeemAndRecordUsageMock(...args)
    };
});

const dbExecuteMock = vi.fn();
const dbInsertValuesMock = vi.fn();
vi.mock('@repo/db', async () => {
    const actual = await vi.importActual('@repo/db');
    return {
        ...actual,
        getDb: vi.fn(() => ({
            execute: dbExecuteMock,
            insert: vi.fn(() => ({ values: dbInsertValuesMock }))
        })),
        billingSubscriptions: { __table: 'billing_subscriptions' },
        commerceListingSubscriptions: { __table: 'commerce_listing_subscriptions' },
        sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
        withTransaction: vi.fn()
    };
});

vi.mock('@repo/schemas', async () => {
    const actual = await vi.importActual('@repo/schemas');
    return {
        ...actual,
        ProductDomainEnum: { ACCOMMODATION: 'accommodation', COMMERCE: 'commerce' }
    };
});

// The ONE difference from subscription-checkout-promo-branches.test.ts:
// the own-preapproval flag is ON here.
vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_BILLING_POLLING_ENABLED: false, HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED: true }
}));
vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { initiatePaidMonthlySubscription } from '../../src/services/subscription-checkout.service';

const PLAN = {
    id: 'plan-uuid-1',
    name: 'owner-premium',
    prices: [
        {
            id: 'price-m',
            billingInterval: 'month',
            intervalCount: 1,
            active: true,
            unitAmount: 10000
        }
    ]
};

const MONTHLY_URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/es/suscriptores/checkout/success/',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

function makeBilling() {
    return {
        plans: { listAll: vi.fn().mockResolvedValue([PLAN]) },
        customers: {
            get: vi.fn().mockResolvedValue({
                id: 'cust-1',
                email: 'a@b.test',
                name: 'A B',
                livemode: false
            })
        },
        subscriptions: { create: vi.fn(), cancel: vi.fn().mockResolvedValue(undefined) },
        getStorage: vi.fn(() => ({}))
    };
}

const MONTHLY_BASE = {
    customerId: 'cust-1',
    userId: 'user-1',
    planSlug: 'owner-premium',
    urls: MONTHLY_URLS
} as const;

describe('initiatePaidMonthlySubscription — promo plumbing into createOwnPreapprovalSubscription (HOS-937 step 1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // HOS-937 step 2: `getMpPayerEmail` reads `billing_customers.mp_payer_email`
        // via `db.execute(sql\`SELECT ...\`)` before resolving the checkout. Not
        // what this suite tests — default it to the real `{ rows: [...] }` shape
        // so the promo-plumbing assertions below stay unaffected.
        dbExecuteMock.mockResolvedValue({ rows: [] });
        createOwnPreapprovalSubscriptionMock.mockResolvedValue({
            subscription: {
                id: 'own-preapproval-sub-1',
                providerSubscriptionIds: { mercadopago: 'mp_preapproval_1' }
            },
            checkoutUrl: 'https://mp.test/subscriptions/checkout?preapproval_id=own-1'
        });
    });

    it('forwards the resolved pendingDiscount snapshot to createOwnPreapprovalSubscription — never drops it', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'discount',
            promoCodeId: 'pc-1',
            code: 'LANZA50',
            effect: { kind: 'discount', valueKind: 'percentage', value: 50, durationCycles: 3 }
        });
        calculatePromoCodeEffectMock.mockReturnValue({
            type: 'apply-discount',
            discountAmount: 5000,
            finalAmount: 5000,
            remainingCycles: 3
        });
        const billing = makeBilling();

        const result = await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            billing: billing as never,
            promoCode: 'LANZA50'
        });

        expect(result.appliedEffect).toBe('discount');
        expect(createPendingProviderSubscriptionMock).not.toHaveBeenCalled();
        expect(createOwnPreapprovalSubscriptionMock).toHaveBeenCalledTimes(1);
        const call = createOwnPreapprovalSubscriptionMock.mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(call.pendingDiscount).toEqual({
            promoCodeId: 'pc-1',
            finalAmountCentavos: 5000,
            durationCycles: 3
        });
    });
});
