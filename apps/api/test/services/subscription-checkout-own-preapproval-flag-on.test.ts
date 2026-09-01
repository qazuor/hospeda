/**
 * Unit tests for `initiatePaidMonthlySubscription` with the HOS-937 step 1
 * own-preapproval flag ON (`HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED`).
 *
 * Mirrors `subscription-checkout.service.test.ts`'s existing coverage of the
 * default (flag OFF) Path C behavior, but asserts the OPPOSITE routing: with
 * the flag on, the service must call `createOwnPreapprovalSubscription`
 * (never `createPendingProviderSubscription`) and map its result into the
 * response shape.
 *
 * Kept as its own file (rather than a new `describe` in the existing 1400+
 * line suite) because the flag is read from `../../src/utils/env` at module
 * scope inside the service — flipping it for a subset of tests in the SAME
 * file would require `vi.doMock` + `vi.resetModules()` gymnastics for every
 * sibling mock. A dedicated file with the flag statically mocked true keeps
 * both suites simple.
 *
 * @module test/services/subscription-checkout-own-preapproval-flag-on
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED: true }
}));

vi.mock('../../src/services/billing/mp-plan-provisioning.service', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../src/services/billing/mp-plan-provisioning.service')
        >();
    return {
        ...actual,
        resolveCheckoutMpPlanId: vi.fn().mockResolvedValue('mp_plan_test'),
        resolveOrProvisionMpPlan: vi.fn()
    };
});

vi.mock('../../src/services/billing/pending-provider-subscription-create', () => ({
    createPendingProviderSubscription: vi.fn()
}));

vi.mock('../../src/services/billing/own-preapproval-subscription-create', () => ({
    createOwnPreapprovalSubscription: vi.fn()
}));

import { resolveCheckoutMpPlanId } from '../../src/services/billing/mp-plan-provisioning.service';
import { createOwnPreapprovalSubscription } from '../../src/services/billing/own-preapproval-subscription-create';
import { createPendingProviderSubscription } from '../../src/services/billing/pending-provider-subscription-create';
import { initiatePaidMonthlySubscription } from '../../src/services/subscription-checkout.service';

const CUSTOMER_ID = 'cust_owner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const MONTHLY_PRICE_ID = 'price_monthly_1';
const LOCAL_SUB_ID = '11111111-1111-4111-8111-111111111111';
const MP_SUBSCRIPTION_ID = 'mp_preapproval_abc';

const MONTHLY_PRICE = {
    id: MONTHLY_PRICE_ID,
    billingInterval: 'month' as const,
    intervalCount: 1,
    active: true
};

const URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/billing/return',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

const CUSTOMER_FIXTURE = {
    id: CUSTOMER_ID,
    email: 'host@hospeda.test',
    name: 'Maria Rodriguez',
    livemode: false
};

function createPlan() {
    return {
        id: PLAN_ID,
        name: 'owner-premium',
        prices: [MONTHLY_PRICE]
    };
}

function createBillingMock() {
    return {
        plans: {
            listAll: vi.fn().mockResolvedValue([createPlan()])
        },
        customers: {
            get: vi.fn().mockResolvedValue(CUSTOMER_FIXTURE)
        },
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([])
        }
    };
}

const OWN_PREAPPROVAL_RESULT = {
    subscription: {
        id: LOCAL_SUB_ID,
        providerSubscriptionIds: { mercadopago: MP_SUBSCRIPTION_ID }
    },
    checkoutUrl: 'https://mp.test/subscriptions/checkout?preapproval_id=own-1'
};

/**
 * HOS-937 step 2: `initiatePaidMonthlySubscription` now reads
 * `billing_customers.mp_payer_email` via raw SQL (`getMpPayerEmail`) before
 * resolving the checkout. The global `@repo/db` mock's `execute()` resolves
 * to a bare `[]` (not `{ rows: [] }`), which is fine for the Drizzle
 * query-builder chains the rest of this suite uses but throws for the raw
 * `db.execute(sql\`...\`)` shape this new read expects. This suite is not
 * about payer-email resolution — stub it out with the real shape so the
 * pre-existing routing/plumbing assertions stay unaffected.
 */
const DB_STUB = { execute: vi.fn().mockResolvedValue({ rows: [] }) };

describe('initiatePaidMonthlySubscription (HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED = true)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(resolveCheckoutMpPlanId).mockResolvedValue('mp_plan_test');
        vi.mocked(createOwnPreapprovalSubscription).mockResolvedValue(
            OWN_PREAPPROVAL_RESULT as any
        );
    });

    it('calls createOwnPreapprovalSubscription, never createPendingProviderSubscription', async () => {
        const billing = createBillingMock();

        await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS,
            db: DB_STUB as any
        });

        expect(createOwnPreapprovalSubscription).toHaveBeenCalledTimes(1);
        expect(createPendingProviderSubscription).not.toHaveBeenCalled();
    });

    it('passes the resolved MP plan id as providerPriceId, plus the monthly plan/price/urls', async () => {
        const billing = createBillingMock();

        await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS,
            db: DB_STUB as any
        });

        expect(createOwnPreapprovalSubscription).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                priceId: MONTHLY_PRICE_ID,
                billingInterval: 'monthly',
                providerPriceId: 'mp_plan_test',
                paymentMethodReturnUrl: URLS.paymentMethodReturnUrl,
                notificationUrl: URLS.notificationUrl
            })
        );
    });

    it('maps the own-preapproval result into checkoutUrl + localSubscriptionId (from subscription.id, not a pre-generated id)', async () => {
        const billing = createBillingMock();

        const result = await initiatePaidMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS,
            db: DB_STUB as any
        });

        expect(result.checkoutUrl).toBe(OWN_PREAPPROVAL_RESULT.checkoutUrl);
        expect(result.localSubscriptionId).toBe(LOCAL_SUB_ID);
    });
});
