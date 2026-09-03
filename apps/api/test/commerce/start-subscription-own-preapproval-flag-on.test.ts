/**
 * Unit tests for `initiateCommerceMonthlySubscription` with the HOS-937
 * step 4 own-preapproval flag ON (`HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED`).
 *
 * Mirrors `subscription-checkout-own-preapproval-flag-on.test.ts`'s coverage
 * of the accommodation monthly path, applied to commerce: with the flag on,
 * the service must call `createOwnPreapprovalSubscription` (never
 * `createPendingProviderSubscription`) stamped with the listing's OWN
 * vertical (`productDomain`, HOS-695) and the entity pointer
 * (`domainMetadata`), and the double-click reuse check must go through
 * `resolveReusableCommerceOwnPreapprovalCheckout` instead of the retired
 * `billing_pending_checkouts`-backed `resolveReusableCommerceCheckout`
 * (spec §6.6-B).
 *
 * `@repo/db` is mocked to an EMPTY database (every `select` resolves to no
 * rows) so the reuse check always finds nothing in flight and a fresh
 * checkout is minted — reuse itself is covered in
 * `test/services/billing/checkout-idempotency-by-entity.test.ts`.
 *
 * @module test/commerce/start-subscription-own-preapproval-flag-on
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

const LOCAL_SUB_ID = '11111111-1111-4111-8111-111111111111';
const MP_SUBSCRIPTION_ID = 'mp_preapproval_commerce_abc';

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
            checkoutUrl: 'https://mp.test/subscriptions/checkout?preapproval_id=own-commerce-1'
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
        select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
        // HOS-937 step 4: `initiateCommerceMonthlySubscription` resolves the
        // payer email via `getMpPayerEmail` (raw `db.execute(sql...)`) before
        // creating the own-preapproval — an empty `mp_payer_email` here just
        // means the resolution falls through to `customer.email`.
        execute: vi.fn().mockResolvedValue({ rows: [] })
    })),
    // `getMpPayerEmail` builds its query with the `sql` tagged template
    // imported directly from `@repo/db` (not a method on the `db` instance),
    // so it needs its own top-level mock entry too.
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    and: vi.fn((...parts: unknown[]) => ({ op: 'and', parts })),
    billingSubscriptions: { __table: 'billing_subscriptions', id: 'id' },
    billingPendingCheckouts: { __table: 'billing_pending_checkouts' },
    entitySubscriptions: {
        __table: 'entity_subscriptions',
        entityType: 'entity_type',
        entityId: 'entity_id'
    },
    partnerSubscriptions: { __table: 'partner_subscriptions', partnerId: 'partner_id' }
}));

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { entitySubscriptions } from '@repo/db';
import { resolveCheckoutMpPlanId } from '../../src/services/billing/mp-plan-provisioning.service';
import { createPendingProviderSubscription } from '../../src/services/billing/pending-provider-subscription-create';
import { initiateCommerceMonthlySubscription } from '../../src/services/subscription-checkout.service';

const CUSTOMER_ID = 'cust_owner';
const CUSTOMER_EMAIL = 'owner@hospeda.test';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const PRICE_ID = 'price_m';
const ENTITY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PLAN_SLUG = 'commerce-listing';

function createBillingMock() {
    return {
        plans: {
            listAll: vi.fn().mockResolvedValue([
                {
                    id: PLAN_ID,
                    name: PLAN_SLUG,
                    metadata: { displayName: 'Comercios' },
                    prices: [
                        {
                            id: PRICE_ID,
                            billingInterval: 'month',
                            intervalCount: 1,
                            active: true,
                            unitAmount: 1_500_000,
                            currency: 'ARS'
                        }
                    ]
                }
            ])
        },
        customers: {
            get: vi.fn().mockResolvedValue({
                id: CUSTOMER_ID,
                email: CUSTOMER_EMAIL,
                name: 'Owner',
                livemode: false
            })
        },
        subscriptions: { getByCustomerId: vi.fn().mockResolvedValue([]) }
    } as unknown as QZPayBilling;
}

const URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/es/comercios/checkout/success/',
    notificationUrl: 'https://api.test/webhooks/mercadopago'
};

const BASE_INPUT = {
    customerId: CUSTOMER_ID,
    planSlug: PLAN_SLUG,
    entityType: 'gastronomy' as const,
    entityId: ENTITY_ID,
    urls: URLS
};

describe('initiateCommerceMonthlySubscription (HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED = true)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(resolveCheckoutMpPlanId).mockResolvedValue('mp_plan_test');
        onConflictDoUpdate.mockResolvedValue(undefined);
        insertValues.mockReturnValue({ onConflictDoUpdate });
        txStub.insert.mockReturnValue({ values: insertValues });
    });

    it('calls createOwnPreapprovalSubscription, never createPendingProviderSubscription', async () => {
        const billing = createBillingMock();

        await initiateCommerceMonthlySubscription({ ...BASE_INPUT, billing });

        expect(createOwnPreapprovalSubscription).toHaveBeenCalledTimes(1);
        expect(createPendingProviderSubscription).not.toHaveBeenCalled();
    });

    it('stamps productDomain to the LISTING OWN vertical (gastronomy), never the retired commerce umbrella', async () => {
        const billing = createBillingMock();

        await initiateCommerceMonthlySubscription({ ...BASE_INPUT, billing });

        const call = createOwnPreapprovalSubscription.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.productDomain).toBe('gastronomy');
        expect(call.productDomain).not.toBe('commerce');
    });

    it('passes the entity pointer as domainMetadata, no externalReference, and the resolved MP plan id', async () => {
        const billing = createBillingMock();

        await initiateCommerceMonthlySubscription({ ...BASE_INPUT, billing });

        const call = createOwnPreapprovalSubscription.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call).toMatchObject({
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            priceId: PRICE_ID,
            billingInterval: 'monthly',
            providerPriceId: 'mp_plan_test',
            domainMetadata: { commerceEntityType: 'gastronomy', commerceEntityId: ENTITY_ID }
        });
        expect(call).not.toHaveProperty('externalReference');
    });

    it('writeDomainLinkRow inserts into entitySubscriptions with the SAME transaction client', async () => {
        const billing = createBillingMock();

        await initiateCommerceMonthlySubscription({ ...BASE_INPUT, billing });

        expect(txStub.insert).toHaveBeenCalledWith(entitySubscriptions);
        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                subscriptionId: LOCAL_SUB_ID,
                productDomain: 'gastronomy',
                entityType: 'gastronomy',
                entityId: ENTITY_ID
            })
        );
    });

    it('maps the own-preapproval result into checkoutUrl + localSubscriptionId', async () => {
        const billing = createBillingMock();

        const result = await initiateCommerceMonthlySubscription({ ...BASE_INPUT, billing });

        expect(result.checkoutUrl).toBe(
            'https://mp.test/subscriptions/checkout?preapproval_id=own-commerce-1'
        );
        expect(result.localSubscriptionId).toBe(LOCAL_SUB_ID);
    });
});
