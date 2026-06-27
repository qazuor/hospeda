/**
 * Unit tests for `initiateCommerceMonthlySubscription` (SPEC-239 T-048).
 *
 * MercadoPago is stubbed at the `billing` boundary; `@repo/db` is stubbed so the
 * raw product_domain UPDATE (D3) and the commerce_listing_subscriptions upsert
 * (D4) are inspectable without a live Postgres. Mirrors start-paid.test.ts mock
 * style (file-local mocks override the global test/setup.ts mocks).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────
// Module mocks (declared BEFORE the import of the service under test).
// ──────────────────────────────────────────────────────────────────────────

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
    // D3+D4 run inside withTransaction; the stub runs the callback with a tx that
    // exposes the same execute/insert spies so the assertions still observe them.
    withTransaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) =>
        cb({ execute: dbExecute, insert: dbInsert })
    ),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    billingSubscriptions: { __table: 'billing_subscriptions' },
    commerceListingSubscriptions: {
        entityType: 'entity_type',
        entityId: 'entity_id'
    }
}));

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { ProductDomainEnum } from '@repo/schemas';
import { initiateCommerceMonthlySubscription } from '../../src/services/subscription-checkout.service';

const CUSTOMER_ID = 'cust_owner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const SUB_ID = '22222222-2222-4222-8222-222222222222';
const ENTITY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function createBillingMock() {
    const create = vi.fn().mockResolvedValue({
        id: SUB_ID,
        status: 'incomplete',
        providerInitPoint: 'https://mp.test/checkout',
        providerSandboxInitPoint: undefined,
        providerSubscriptionIds: { mercadopago: 'mp_123' }
    });
    const billing = {
        plans: {
            list: vi.fn().mockResolvedValue({
                data: [
                    {
                        id: PLAN_ID,
                        name: 'commerce-listing',
                        prices: [
                            {
                                id: 'price_m',
                                billingInterval: 'month',
                                intervalCount: 1,
                                active: true
                            }
                        ]
                    }
                ]
            })
        },
        subscriptions: { create },
        getStorage: vi.fn(() => ({ subscriptionPollingJobs: undefined }))
    };
    // TYPE-WORKAROUND: the test stub implements only the subset of QZPayBilling
    // the service touches (plans.list, subscriptions.create, getStorage); cast
    // to the full interface so call sites need no per-call `any`.
    return { billing: billing as unknown as QZPayBilling, create };
}

const URLS = {
    paymentMethodReturnUrl: 'https://admin.test/commerce',
    notificationUrl: 'https://api.test/webhooks/mercadopago'
};

describe('initiateCommerceMonthlySubscription (SPEC-239 T-048)', () => {
    beforeEach(() => {
        dbExecute.mockClear();
        dbInsert.mockClear();
        insertValues.mockClear();
        onConflictDoUpdate.mockClear();
    });

    it('creates the MP subscription with commerce metadata and returns the checkout URL', async () => {
        const { billing, create } = createBillingMock();

        const result = await initiateCommerceMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'commerce-listing',
            entityType: 'gastronomy',
            entityId: ENTITY_ID,
            billing,
            urls: URLS
        });

        expect(result.checkoutUrl).toBe('https://mp.test/checkout');
        expect(result.localSubscriptionId).toBe(SUB_ID);

        expect(create).toHaveBeenCalledTimes(1);
        const createArg = create.mock.calls[0]?.[0] as {
            mode: string;
            billingInterval: string;
            metadata: Record<string, unknown>;
        };
        expect(createArg.mode).toBe('paid');
        expect(createArg.billingInterval).toBe('monthly');
        expect(createArg.metadata.productDomain).toBe(ProductDomainEnum.COMMERCE);
        expect(createArg.metadata.entityType).toBe('gastronomy');
        expect(createArg.metadata.entityId).toBe(ENTITY_ID);
    });

    it('stamps product_domain=commerce via a raw UPDATE (D3)', async () => {
        const { billing } = createBillingMock();

        await initiateCommerceMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'commerce-listing',
            entityType: 'gastronomy',
            entityId: ENTITY_ID,
            billing,
            urls: URLS
        });

        expect(dbExecute).toHaveBeenCalledTimes(1);
        const sqlArg = dbExecute.mock.calls[0]?.[0] as { values: unknown[] };
        // Interpolated values are [ 'commerce', subscriptionId ].
        expect(sqlArg.values).toContain(ProductDomainEnum.COMMERCE);
        expect(sqlArg.values).toContain(SUB_ID);
    });

    it('upserts the link row on the (entity_type, entity_id) unique constraint (D4)', async () => {
        const { billing } = createBillingMock();

        await initiateCommerceMonthlySubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'commerce-listing',
            entityType: 'gastronomy',
            entityId: ENTITY_ID,
            billing,
            urls: URLS
        });

        expect(dbInsert).toHaveBeenCalledTimes(1);
        const insertedValues = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(insertedValues.subscriptionId).toBe(SUB_ID);
        expect(insertedValues.productDomain).toBe(ProductDomainEnum.COMMERCE);
        expect(insertedValues.entityType).toBe('gastronomy');
        expect(insertedValues.entityId).toBe(ENTITY_ID);
        expect(insertedValues.status).toBe('incomplete');

        expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
        const conflictArg = onConflictDoUpdate.mock.calls[0]?.[0] as {
            target: unknown[];
            set: Record<string, unknown>;
        };
        expect(conflictArg.target).toHaveLength(2);
        expect(conflictArg.set.subscriptionId).toBe(SUB_ID);
        expect(conflictArg.set.status).toBe('incomplete');
    });

    it('throws PLAN_NOT_FOUND when the plan slug is unknown', async () => {
        const { billing } = createBillingMock();
        billing.plans.list = vi.fn().mockResolvedValue({ data: [] });

        await expect(
            initiateCommerceMonthlySubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'does-not-exist',
                entityType: 'gastronomy',
                entityId: ENTITY_ID,
                billing,
                urls: URLS
            })
        ).rejects.toThrow(/not found/i);
    });

    it('throws MISSING_INIT_POINT when the provider returns no checkout URL', async () => {
        const { billing, create } = createBillingMock();
        create.mockResolvedValueOnce({
            id: SUB_ID,
            status: 'incomplete',
            providerInitPoint: undefined,
            providerSandboxInitPoint: undefined,
            providerSubscriptionIds: { mercadopago: 'mp_123' }
        });

        await expect(
            initiateCommerceMonthlySubscription({
                customerId: CUSTOMER_ID,
                planSlug: 'commerce-listing',
                entityType: 'gastronomy',
                entityId: ENTITY_ID,
                billing,
                urls: URLS
            })
        ).rejects.toThrow(/checkout url/i);
    });
});
