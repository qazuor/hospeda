import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_BILLING_POLLING_ENABLED: false }
}));

vi.mock('@repo/billing', () => ({
    resolveFreeTrialExtensionPromo: vi.fn(() => null)
}));

const dbExecute = vi.fn((_query: unknown) => Promise.resolve(undefined));
const onConflictDoUpdate = vi.fn((_config: unknown) => Promise.resolve(undefined));
const insertValues = vi.fn((_values: unknown) => ({ onConflictDoUpdate }));
const dbInsert = vi.fn((_table: unknown) => ({ values: insertValues }));

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({ execute: dbExecute, insert: dbInsert })),
    withTransaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) =>
        cb({ execute: dbExecute, insert: dbInsert })
    ),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    billingSubscriptions: { __table: 'billing_subscriptions' },
    commerceListingSubscriptions: { entityType: 'entity_type', entityId: 'entity_id' },
    partnerSubscriptions: { partnerId: 'partner_id' }
}));

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { ProductDomainEnum } from '@repo/schemas';
import { initiatePartnerMonthlySubscription } from '../../src/services/subscription-checkout.service';

const CUSTOMER_ID = 'cust_partner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000bb';
const SUB_ID = '33333333-3333-4333-8333-333333333333';
const PARTNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function createBillingMock() {
    const create = vi.fn().mockResolvedValue({
        id: SUB_ID,
        status: 'incomplete',
        providerInitPoint: 'https://mp.test/partner-checkout',
        providerSandboxInitPoint: undefined,
        providerSubscriptionIds: { mercadopago: 'mp_456' }
    });

    const billing = {
        plans: {
            get: vi.fn().mockResolvedValue({
                id: PLAN_ID,
                name: 'partner-listing',
                prices: [
                    {
                        id: 'price_partner_m',
                        billingInterval: 'month',
                        intervalCount: 1,
                        active: true
                    }
                ]
            })
        },
        subscriptions: { create },
        getStorage: vi.fn(() => ({ subscriptionPollingJobs: undefined }))
    };

    return { billing: billing as unknown as QZPayBilling, create };
}

const URLS = {
    paymentMethodReturnUrl: 'https://admin.test/partners',
    notificationUrl: 'https://api.test/webhooks/mercadopago'
};

describe('initiatePartnerMonthlySubscription (SPEC-271)', () => {
    beforeEach(() => {
        dbExecute.mockClear();
        dbInsert.mockClear();
        insertValues.mockClear();
        onConflictDoUpdate.mockClear();
    });

    it('creates the MP subscription with partner metadata and returns the checkout URL', async () => {
        const { billing, create } = createBillingMock();

        const result = await initiatePartnerMonthlySubscription({
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            partnerId: PARTNER_ID,
            billing,
            urls: URLS
        });

        expect(result.checkoutUrl).toBe('https://mp.test/partner-checkout');
        expect(result.localSubscriptionId).toBe(SUB_ID);

        const createArg = create.mock.calls[0]?.[0] as {
            metadata: Record<string, unknown>;
            mode: string;
            billingInterval: string;
        };
        expect(createArg.mode).toBe('paid');
        expect(createArg.billingInterval).toBe('monthly');
        expect(createArg.metadata.productDomain).toBe(ProductDomainEnum.PARTNER);
        expect(createArg.metadata.partnerId).toBe(PARTNER_ID);
    });

    it('stamps product_domain=partner and upserts the partner link row', async () => {
        const { billing } = createBillingMock();

        await initiatePartnerMonthlySubscription({
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            partnerId: PARTNER_ID,
            billing,
            urls: URLS
        });

        expect(dbExecute).toHaveBeenCalledTimes(1);
        const sqlArg = dbExecute.mock.calls[0]?.[0] as { values: unknown[] };
        expect(sqlArg.values).toContain(ProductDomainEnum.PARTNER);
        expect(sqlArg.values).toContain(SUB_ID);

        const insertedValues = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(insertedValues.partnerId).toBe(PARTNER_ID);
        expect(insertedValues.subscriptionId).toBe(SUB_ID);
        expect(insertedValues.productDomain).toBe(ProductDomainEnum.PARTNER);
        expect(insertedValues.status).toBe('incomplete');
    });
});
