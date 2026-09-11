/**
 * Unit tests for `initiatePaidAnnualSubscription` with the HOS-937 step 4
 * own-preapproval flag ON (`HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED`).
 *
 * Mirrors `subscription-checkout-own-preapproval-flag-on.test.ts`'s coverage
 * of the monthly path, applied to annual: with the flag on, the service must
 * call `createOwnPreapprovalSubscription` (never `createPendingProviderSubscription`)
 * with `billingInterval: 'annual'` and an explicit `productDomain` resolved
 * from the plan (HOS-1271 — no longer omitted, see that spec for why the
 * omission was never actually "the column's own DB default" doing the work).
 *
 * Kept as its own file for the same reason the monthly flag-on suite is: the
 * flag is read from `../../src/utils/env` at module scope, so flipping it for
 * a subset of tests in a shared file would need `vi.doMock` +
 * `vi.resetModules()` gymnastics.
 *
 * @module test/services/subscription-checkout-own-preapproval-annual-flag-on
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
        resolveCheckoutMpPlanId: vi.fn().mockResolvedValue('mp_plan_annual_test'),
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
import { initiatePaidAnnualSubscription } from '../../src/services/subscription-checkout.service';

const CUSTOMER_ID = 'cust_owner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const ANNUAL_PRICE_ID = 'price_annual_1';
const LOCAL_SUB_ID = '11111111-1111-4111-8111-111111111111';
const MP_SUBSCRIPTION_ID = 'mp_preapproval_annual_abc';

const ANNUAL_PRICE = {
    id: ANNUAL_PRICE_ID,
    billingInterval: 'year' as const,
    intervalCount: 1,
    active: true
};

const URLS = {
    successUrl: 'https://hospeda.test/billing/success',
    cancelUrl: 'https://hospeda.test/billing/cancel',
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
        // `name` IS the slug on a qzpay plan; `metadata.displayName` is what
        // every seeded plan carries and what the buyer must read (HOS-1221 D4).
        name: 'owner-premium',
        metadata: { displayName: 'Anfitrión Premium' },
        prices: [ANNUAL_PRICE]
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
    checkoutUrl: 'https://mp.test/subscriptions/checkout?preapproval_id=own-annual-1'
};

/**
 * HOS-937 step 2 (merged into the annual own-preapproval branch alongside
 * step 4): `initiatePaidAnnualSubscription` now reads
 * `billing_customers.mp_payer_email` via raw SQL (`getMpPayerEmail`) before
 * resolving the checkout. The global `@repo/db` mock's `execute()` resolves
 * to a bare `[]` (not `{ rows: [] }`) — fine for the Drizzle query-builder
 * chains, but throws for the raw `db.execute(sql\`...\`)` shape this read
 * expects. This suite is not about payer-email resolution — stub it out with
 * the real shape, same fix as the monthly flag-on suite.
 *
 * HOS-1271: `initiatePaidAnnualSubscription` also reads the resolved plan's
 * `billing_plans.product_domain` (via `resolvePlanProductDomain`) to validate
 * it and stamp it explicitly — a `.select().from().where().limit()` chain,
 * distinct from the raw-SQL `.execute()` above. Every fixture here is an
 * accommodation plan, so this answers ACCOMMODATION unconditionally.
 */
const DB_STUB = {
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    select: vi.fn(() => ({
        from: vi.fn(() => ({
            where: vi.fn(() => {
                const limit = vi.fn(() =>
                    Promise.resolve([{ productDomain: 'accommodation', createdAt: new Date() }])
                );
                return { limit, orderBy: vi.fn(() => ({ limit })) };
            })
        }))
    }))
};

describe('initiatePaidAnnualSubscription (HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED = true)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(resolveCheckoutMpPlanId).mockResolvedValue('mp_plan_annual_test');
        vi.mocked(createOwnPreapprovalSubscription).mockResolvedValue(
            OWN_PREAPPROVAL_RESULT as any
        );
    });

    it('calls createOwnPreapprovalSubscription, never createPendingProviderSubscription', async () => {
        const billing = createBillingMock();

        await initiatePaidAnnualSubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS,
            db: DB_STUB as any
        });

        expect(createOwnPreapprovalSubscription).toHaveBeenCalledTimes(1);
        expect(createPendingProviderSubscription).not.toHaveBeenCalled();
    });

    it('records billingInterval: annual, the resolved MP plan id, and urls.successUrl as the back_url — with no providerPriceId and no externalReference', async () => {
        const billing = createBillingMock();

        await initiatePaidAnnualSubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as any,
            urls: URLS,
            db: DB_STUB as any
        });

        expect(createOwnPreapprovalSubscription).toHaveBeenCalledTimes(1);
        const call = vi.mocked(createOwnPreapprovalSubscription).mock
            .calls[0]?.[0] as unknown as Record<string, unknown>;
        expect(call).toMatchObject({
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: ANNUAL_PRICE_ID,
            billingInterval: 'annual',
            mpPreapprovalPlanId: 'mp_plan_annual_test',
            paymentMethodReturnUrl: URLS.successUrl,
            notificationUrl: URLS.notificationUrl
        });
        // HOS-1221: the plan id is RECORDED (above) and never forwarded to
        // MercadoPago. `providerPriceId` is the forwarded field, and with it set
        // `POST /preapproval` becomes the plan-based request MercadoPago
        // rejects with "card_token_id is required" — which is what made this
        // checkout answer 500. Asserted as an absence because `toMatchObject`,
        // like `expect.objectContaining`, is blind to a field that should not
        // be there.
        expect(call).not.toHaveProperty('providerPriceId');
        // HOS-1221 D4: the buyer-visible name, not the slug. The adapter
        // appends " - Anual" to it.
        expect(call.planDisplayName).toBe('Anfitrión Premium');
        expect(call.planDisplayName).not.toBe('owner-premium');
        expect(call).not.toHaveProperty('externalReference');
        expect(call).not.toHaveProperty('writeDomainLinkRow');
        // HOS-1271 REGRESSION: `productDomain` used to be omitted entirely on
        // this branch — harmless only because `createPaidSubscription` (one
        // layer down) independently resolves the same value from the plan's
        // own row. Stated explicitly here too now, resolved from the SAME
        // plan (accommodation), for consistency with the other three checkout
        // branches and so this row's domain does not depend solely on that
        // deeper call never regressing.
        expect(call.productDomain).toBe('accommodation');
    });

    it('maps the own-preapproval result into checkoutUrl + localSubscriptionId (from subscription.id, not a pre-generated id)', async () => {
        const billing = createBillingMock();

        const result = await initiatePaidAnnualSubscription({
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
