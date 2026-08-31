/**
 * Unit tests for `initiatePartnerMonthlySubscription` with the HOS-937 step 4
 * own-preapproval flag ON (`HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED`).
 *
 * Mirrors `subscription-checkout-own-preapproval-flag-on.test.ts`'s coverage
 * of the accommodation monthly path, applied to partner: with the flag on,
 * the service must call `createOwnPreapprovalSubscription` (never
 * `createPendingProviderSubscription`) stamped with `productDomain: 'partner'`
 * and the entity pointer (`{ partnerId }`), with NO payer email snapshot
 * (the synthetic `@partners.hospeda.invalid` address must never be
 * forwarded — see `initiatePartnerMonthlySubscription`'s own JSDoc), and the
 * double-click reuse check must go through
 * `resolveReusablePartnerOwnPreapprovalCheckout` instead of the retired
 * `billing_pending_checkouts`-backed `resolveReusablePartnerCheckout` (spec
 * §6.6-B).
 *
 * `@repo/db` is mocked to an EMPTY database (every `select` resolves to no
 * rows) so the reuse check always finds nothing in flight — reuse itself is
 * covered in `test/services/billing/checkout-idempotency-by-entity.test.ts`.
 *
 * @module test/partners/start-subscription-own-preapproval-flag-on
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED: true }
}));

vi.mock('@repo/billing', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/billing')>()),
    resolveFreeTrialExtensionPromo: vi.fn(() => null),
    applyTestControl: vi.fn(async (_op: string, _args: unknown, realCall: () => Promise<unknown>) =>
        realCall()
    ),
    TEST_DAILY_PLAN: { slug: 'owner-test-daily' }
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

/** Fake transaction handed to the `writeDomainLinkRow` callback. */
const onConflictDoUpdate = vi.fn((_config: unknown) => Promise.resolve(undefined));
const insertValues = vi.fn((_values: unknown) => ({ onConflictDoUpdate }));
const txStub = { insert: vi.fn((_table: unknown) => ({ values: insertValues })) };

const LOCAL_SUB_ID = '33333333-3333-4333-8333-333333333333';
const MP_SUBSCRIPTION_ID = 'mp_preapproval_partner_abc';

const createOwnPreapprovalSubscription = vi.fn(
    async (input: {
        writeDomainLinkRow?: (params: {
            tx: unknown;
            localSubscriptionId: string;
        }) => Promise<void>;
    }) => {
        await input.writeDomainLinkRow?.({ tx: txStub, localSubscriptionId: LOCAL_SUB_ID });
        return {
            subscription: {
                id: LOCAL_SUB_ID,
                providerSubscriptionIds: { mercadopago: MP_SUBSCRIPTION_ID }
            },
            checkoutUrl: 'https://mp.test/subscriptions/checkout?preapproval_id=own-partner-1'
        };
    }
);

vi.mock('../../src/services/billing/own-preapproval-subscription-create', () => ({
    createOwnPreapprovalSubscription: (input: never) => createOwnPreapprovalSubscription(input)
}));

vi.mock('@repo/db', () => ({
    // Empty DB: every `select(...)` resolves to no rows, so the §6.6-B reuse
    // check finds nothing in flight for every case here. Reuse itself is
    // covered in `test/services/billing/checkout-idempotency-by-entity.test.ts`.
    getDb: vi.fn(() => ({
        select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) })
    })),
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    and: vi.fn((...parts: unknown[]) => ({ op: 'and', parts })),
    billingSubscriptions: { __table: 'billing_subscriptions', id: 'id' },
    billingPendingCheckouts: { __table: 'billing_pending_checkouts' },
    commerceListingSubscriptions: {
        __table: 'commerce_listing_subscriptions',
        entityType: 'entity_type',
        entityId: 'entity_id'
    },
    partnerSubscriptions: { __table: 'partner_subscriptions', partnerId: 'partner_id' }
}));

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { partnerSubscriptions } from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import { resolveCheckoutMpPlanId } from '../../src/services/billing/mp-plan-provisioning.service';
import { createPendingProviderSubscription } from '../../src/services/billing/pending-provider-subscription-create';
import { initiatePartnerMonthlySubscription } from '../../src/services/subscription-checkout.service';

const CUSTOMER_ID = 'cust_partner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000bb';
const PRICE_ID = 'price_partner_m';
const PARTNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SYNTHETIC_PARTNER_EMAIL = `partner-${PARTNER_ID}@partners.hospeda.invalid`;

function createBillingMock(): QZPayBilling {
    return {
        plans: {
            get: vi.fn().mockResolvedValue({
                id: PLAN_ID,
                name: 'partner-listing',
                metadata: { displayName: 'Partner Gold' },
                prices: [
                    {
                        id: PRICE_ID,
                        billingInterval: 'month',
                        intervalCount: 1,
                        active: true,
                        unitAmount: 2_000_000,
                        currency: 'ARS'
                    }
                ]
            })
        },
        customers: {
            get: vi.fn().mockResolvedValue({
                id: CUSTOMER_ID,
                email: SYNTHETIC_PARTNER_EMAIL,
                name: 'Partner',
                livemode: false
            })
        }
    } as unknown as QZPayBilling;
}

const URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/es/admin/partners/checkout/success/',
    notificationUrl: 'https://api.test/webhooks/mercadopago'
};

const BASE_INPUT = {
    customerId: CUSTOMER_ID,
    planId: PLAN_ID,
    partnerId: PARTNER_ID,
    urls: URLS
};

describe('initiatePartnerMonthlySubscription (HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED = true)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(resolveCheckoutMpPlanId).mockResolvedValue('mp_plan_test');
        onConflictDoUpdate.mockResolvedValue(undefined);
        insertValues.mockReturnValue({ onConflictDoUpdate });
        txStub.insert.mockReturnValue({ values: insertValues });
    });

    it('calls createOwnPreapprovalSubscription, never createPendingProviderSubscription', async () => {
        const billing = createBillingMock();

        await initiatePartnerMonthlySubscription({ ...BASE_INPUT, billing });

        expect(createOwnPreapprovalSubscription).toHaveBeenCalledTimes(1);
        expect(createPendingProviderSubscription).not.toHaveBeenCalled();
    });

    it('stamps productDomain: partner and NEVER forwards the synthetic partner email', async () => {
        const billing = createBillingMock();

        await initiatePartnerMonthlySubscription({ ...BASE_INPUT, billing });

        const call = createOwnPreapprovalSubscription.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.productDomain).toBe(ProductDomainEnum.PARTNER);
        expect(call).not.toHaveProperty('payerEmail');
    });

    it('passes {partnerId} as domainMetadata, no externalReference, and the resolved MP plan id', async () => {
        const billing = createBillingMock();

        await initiatePartnerMonthlySubscription({ ...BASE_INPUT, billing });

        const call = createOwnPreapprovalSubscription.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call).toMatchObject({
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            billingInterval: 'monthly',
            providerPriceId: 'mp_plan_test',
            domainMetadata: { partnerId: PARTNER_ID }
        });
        expect(call).not.toHaveProperty('externalReference');
    });

    it('writeDomainLinkRow inserts into partnerSubscriptions with the SAME transaction client', async () => {
        const billing = createBillingMock();

        await initiatePartnerMonthlySubscription({ ...BASE_INPUT, billing });

        expect(txStub.insert).toHaveBeenCalledWith(partnerSubscriptions);
        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                subscriptionId: LOCAL_SUB_ID,
                productDomain: ProductDomainEnum.PARTNER,
                partnerId: PARTNER_ID
            })
        );
    });

    it('maps the own-preapproval result into checkoutUrl + localSubscriptionId', async () => {
        const billing = createBillingMock();

        const result = await initiatePartnerMonthlySubscription({ ...BASE_INPUT, billing });

        expect(result.checkoutUrl).toBe(
            'https://mp.test/subscriptions/checkout?preapproval_id=own-partner-1'
        );
        expect(result.localSubscriptionId).toBe(LOCAL_SUB_ID);
    });
});
