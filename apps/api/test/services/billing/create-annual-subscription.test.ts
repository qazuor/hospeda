/**
 * Unit tests for the shared annual-subscription-create helper (HOS-123 T-001).
 *
 * Covers:
 * - Local row insert: `pending_provider` status, `billingInterval: 'year'`,
 *   `intervalCount: 1`.
 * - `billing.checkout.create` invocation: `mode: 'payment'` plus the exact
 *   line-item / URL shape (successUrl/cancelUrl/notificationUrl, payer
 *   name-split fields, idempotencyKey).
 * - Arbitrary `metadata` (including `supersedesSubscriptionId`) propagates
 *   onto BOTH the checkout call's metadata and the local row's metadata.
 * - Fail-closed: `CUSTOMER_NOT_FOUND` when the billing customer is missing.
 * - Fail-closed: `MISSING_INIT_POINT` when neither init point is returned.
 * - Sandbox fallback: `providerSandboxInitPoint` used when `providerInitPoint`
 *   is absent.
 * - Polling enqueue: `billing.getStorage().subscriptionPollingJobs.create`
 *   is called with `resourceType: 'one_time_payment'`.
 *
 * @module test/services/billing/create-annual-subscription
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnnualSubscription } from '../../../src/services/billing/create-annual-subscription';
import { SubscriptionCheckoutError } from '../../../src/services/billing/subscription-checkout-error';

const CUSTOMER_ID = 'cust_owner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const PRICE_ID = 'price_annual_1';
const SUPERSEDED_SUB_ID = '22222222-2222-4222-8222-222222222222';

const PLAN = {
    id: PLAN_ID,
    name: 'owner-premium'
};

const URLS = {
    successUrl: 'https://hospeda.test/billing/return?ref=local',
    cancelUrl: 'https://hospeda.test/billing/return?ref=local&cancelled=1',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

interface CustomerFixture {
    id: string;
    email: string;
    name: string | null;
    livemode: boolean;
}

const CUSTOMER_FIXTURE: CustomerFixture = {
    id: CUSTOMER_ID,
    email: 'host@hospeda.test',
    name: 'Maria Rodriguez',
    livemode: false
};

interface BillingMockOpts {
    customer?: CustomerFixture | null;
    checkoutResult?: {
        id?: string;
        providerInitPoint?: string;
        providerSandboxInitPoint?: string;
    } | null;
    pollingJobsStorage?: {
        create: ReturnType<typeof vi.fn>;
    } | null;
}

function createBillingMock(opts: BillingMockOpts = {}) {
    const customer = opts.customer === undefined ? CUSTOMER_FIXTURE : opts.customer;
    const checkoutResult =
        opts.checkoutResult === undefined
            ? { id: 'checkout-1', providerInitPoint: 'https://mp.test/checkout/annual-abc' }
            : opts.checkoutResult;
    const pollingJobsStorage =
        opts.pollingJobsStorage === undefined ? undefined : opts.pollingJobsStorage;

    return {
        customers: { get: vi.fn().mockResolvedValue(customer) },
        checkout: { create: vi.fn().mockResolvedValue(checkoutResult) },
        getStorage: vi.fn(() => ({
            ...(pollingJobsStorage ? { subscriptionPollingJobs: pollingJobsStorage } : {})
        }))
    };
}

function makeStubDb() {
    const insertCalls: Array<{ table: unknown; values: Record<string, unknown> }> = [];
    const stub = {
        insert(table: unknown) {
            return {
                values(values: Record<string, unknown>) {
                    insertCalls.push({ table, values });
                    return Promise.resolve(undefined);
                }
            };
        }
    };
    return {
        stub: stub as unknown as Parameters<typeof createAnnualSubscription>[0]['db'],
        insertCalls
    };
}

describe('createAnnualSubscription', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('inserts a pending_provider local row with billingInterval: year and intervalCount: 1', async () => {
        const billing = createBillingMock();
        const { stub, insertCalls } = makeStubDb();
        const before = Date.now();

        const result = await createAnnualSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            plan: PLAN,
            priceId: PRICE_ID,
            chargeAmountCentavos: 35_000_000,
            urls: URLS,
            db: stub
        });

        const after = Date.now();

        expect(result.checkoutUrl).toBe('https://mp.test/checkout/annual-abc');
        expect(typeof result.localSubscriptionId).toBe('string');
        expect(result.localSubscriptionId).toMatch(/^[0-9a-f-]{36}$/i);

        const expiresAtMs = new Date(result.expiresAt).getTime();
        expect(expiresAtMs).toBeGreaterThanOrEqual(before + 30 * 60 * 1000 - 2000);
        expect(expiresAtMs).toBeLessThanOrEqual(after + 30 * 60 * 1000 + 2000);

        expect(insertCalls).toHaveLength(1);
        const subRow = insertCalls[0]?.values as Record<string, unknown>;
        expect(subRow.customerId).toBe(CUSTOMER_ID);
        expect(subRow.planId).toBe(PLAN_ID);
        expect(subRow.billingInterval).toBe('year');
        expect(subRow.intervalCount).toBe(1);
        expect(subRow.status).toBe('pending_provider');
        expect(subRow.livemode).toBe(false);
        const subStart = subRow.currentPeriodStart as Date;
        const subEnd = subRow.currentPeriodEnd as Date;
        expect(subEnd.getTime() - subStart.getTime()).toBe(365 * 24 * 60 * 60 * 1000);
    });

    it('calls billing.checkout.create with mode: payment and the exact line-item/URL shape', async () => {
        const billing = createBillingMock();
        const { stub } = makeStubDb();

        await createAnnualSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            plan: PLAN,
            priceId: PRICE_ID,
            chargeAmountCentavos: 35_000_000,
            urls: URLS,
            statementDescriptor: 'HOSPEDA',
            db: stub
        });

        expect(billing.checkout.create).toHaveBeenCalledTimes(1);
        const call = billing.checkout.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.mode).toBe('payment');

        const lineItems = call.lineItems as Array<Record<string, unknown>>;
        expect(lineItems).toHaveLength(1);
        expect(lineItems[0]).toMatchObject({
            unitAmount: 35_000_000,
            currency: 'ARS',
            quantity: 1,
            categoryId: 'services'
        });
        expect((lineItems[0]?.title as string).toLowerCase()).toContain('annual');

        expect(call.successUrl).toBe(URLS.successUrl);
        expect(call.cancelUrl).toBe(URLS.cancelUrl);
        expect(call.notificationUrl).toBe(URLS.notificationUrl);
        expect(call.customerId).toBe(CUSTOMER_ID);
        expect(call.customerEmail).toBe(CUSTOMER_FIXTURE.email);
        expect(call.customerName).toBe('Maria Rodriguez');
        expect(call.payerFirstName).toBe('Maria');
        expect(call.payerLastName).toBe('Rodriguez');
        expect(call.statementDescriptor).toBe('HOSPEDA');
        expect(typeof call.idempotencyKey).toBe('string');
    });

    it('propagates arbitrary metadata (including supersedesSubscriptionId) onto the checkout metadata', async () => {
        const billing = createBillingMock();
        const { stub, insertCalls } = makeStubDb();

        await createAnnualSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            plan: PLAN,
            priceId: PRICE_ID,
            chargeAmountCentavos: 35_000_000,
            urls: URLS,
            metadata: {
                supersedesSubscriptionId: SUPERSEDED_SUB_ID,
                convertedFromTrial: 'true'
            },
            db: stub
        });

        const call = billing.checkout.create.mock.calls[0]?.[0] as Record<string, unknown>;
        const metadata = call.metadata as Record<string, unknown>;
        expect(metadata.supersedesSubscriptionId).toBe(SUPERSEDED_SUB_ID);
        expect(metadata.convertedFromTrial).toBe('true');
        expect(metadata.billingInterval).toBe('annual');
        expect(typeof metadata.annualSubscriptionId).toBe('string');
        expect(call.idempotencyKey).toBe(metadata.annualSubscriptionId);

        // Also visible on the local row's own metadata column.
        const subRow = insertCalls[0]?.values as Record<string, unknown>;
        const subMetadata = subRow.metadata as Record<string, unknown>;
        expect(subMetadata.supersedesSubscriptionId).toBe(SUPERSEDED_SUB_ID);
        expect(subMetadata.convertedFromTrial).toBe('true');
    });

    it('throws SubscriptionCheckoutError(CUSTOMER_NOT_FOUND) when the billing customer is missing', async () => {
        const billing = createBillingMock({ customer: null });
        const { stub, insertCalls } = makeStubDb();

        await expect(
            createAnnualSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                plan: PLAN,
                priceId: PRICE_ID,
                chargeAmountCentavos: 35_000_000,
                urls: URLS,
                db: stub
            })
        ).rejects.toMatchObject({
            name: 'SubscriptionCheckoutError',
            code: 'CUSTOMER_NOT_FOUND'
        });

        expect(insertCalls).toHaveLength(0);
        expect(billing.checkout.create).not.toHaveBeenCalled();
    });

    it('throws SubscriptionCheckoutError(MISSING_INIT_POINT) when neither init point is returned', async () => {
        const billing = createBillingMock({
            checkoutResult: { id: 'checkout-2' }
        });
        const { stub } = makeStubDb();

        await expect(
            createAnnualSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                plan: PLAN,
                priceId: PRICE_ID,
                chargeAmountCentavos: 35_000_000,
                urls: URLS,
                db: stub
            })
        ).rejects.toMatchObject({
            name: 'SubscriptionCheckoutError',
            code: 'MISSING_INIT_POINT'
        });

        try {
            await createAnnualSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                plan: PLAN,
                priceId: PRICE_ID,
                chargeAmountCentavos: 35_000_000,
                urls: URLS,
                db: stub
            });
            expect.unreachable('createAnnualSubscription should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(SubscriptionCheckoutError);
        }
    });

    it('falls back to the sandbox init point when the provider init point is absent', async () => {
        const billing = createBillingMock({
            checkoutResult: {
                id: 'checkout-3',
                providerSandboxInitPoint: 'https://sandbox.mp.test/annual-xyz'
            }
        });
        const { stub } = makeStubDb();

        const result = await createAnnualSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            plan: PLAN,
            priceId: PRICE_ID,
            chargeAmountCentavos: 35_000_000,
            urls: URLS,
            db: stub
        });

        expect(result.checkoutUrl).toBe('https://sandbox.mp.test/annual-xyz');
    });

    it('omits payerFirstName/payerLastName/customerName when the customer has no name', async () => {
        const billing = createBillingMock({
            customer: { ...CUSTOMER_FIXTURE, name: null }
        });
        const { stub } = makeStubDb();

        await createAnnualSubscription({
            billing: billing as any,
            customerId: CUSTOMER_ID,
            plan: PLAN,
            priceId: PRICE_ID,
            chargeAmountCentavos: 35_000_000,
            urls: URLS,
            db: stub
        });

        const call = billing.checkout.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.customerName).toBeUndefined();
        expect(call.payerFirstName).toBeUndefined();
        expect(call.payerLastName).toBeUndefined();
    });

    it('calls the polling storage with resourceType: one_time_payment after a successful checkout', async () => {
        // HOSPEDA_BILLING_POLLING_ENABLED is `false` in .env.test (deliberately,
        // so background polling never bleeds into other tests — see the comment
        // in apps/api/.env.test). Flip the live env object's flag for the
        // duration of this one test only, mirroring the pattern used in
        // test/cron/subscription-poll.job.test.ts.
        const envModule = await import('../../../src/utils/env.js');
        const envRef = envModule.env as { HOSPEDA_BILLING_POLLING_ENABLED: boolean };
        const originalFlag = envRef.HOSPEDA_BILLING_POLLING_ENABLED;
        envRef.HOSPEDA_BILLING_POLLING_ENABLED = true;

        try {
            const pollingJobsCreate = vi.fn().mockResolvedValue({
                id: 'job-1',
                nextPollAt: new Date('2030-01-01T00:05:00Z')
            });
            const billing = createBillingMock({
                checkoutResult: {
                    id: 'checkout-4',
                    providerInitPoint: 'https://mp.test/checkout/annual-abc'
                },
                pollingJobsStorage: { create: pollingJobsCreate }
            });
            const { stub } = makeStubDb();

            const result = await createAnnualSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                plan: PLAN,
                priceId: PRICE_ID,
                chargeAmountCentavos: 35_000_000,
                urls: URLS,
                db: stub
            });

            expect(pollingJobsCreate).toHaveBeenCalledTimes(1);
            const call = pollingJobsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(call.resourceType).toBe('one_time_payment');
            expect(call.provider).toBe('mercadopago');
            expect(call.providerResourceId).toBe('checkout-4');
            expect(call.subscriptionId).toBe(result.localSubscriptionId);
        } finally {
            envRef.HOSPEDA_BILLING_POLLING_ENABLED = originalFlag;
        }
    });

    it('does not throw when the polling storage is absent (short-circuits cleanly)', async () => {
        const billing = createBillingMock({ pollingJobsStorage: null });
        const { stub } = makeStubDb();

        await expect(
            createAnnualSubscription({
                billing: billing as any,
                customerId: CUSTOMER_ID,
                plan: PLAN,
                priceId: PRICE_ID,
                chargeAmountCentavos: 35_000_000,
                urls: URLS,
                db: stub
            })
        ).resolves.toMatchObject({ localSubscriptionId: expect.any(String) });
    });
});
