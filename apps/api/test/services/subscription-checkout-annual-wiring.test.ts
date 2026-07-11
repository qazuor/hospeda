/**
 * Call-site wiring regression test (HOS-123 T-002).
 *
 * `initiatePaidAnnualSubscription`'s mechanical create-and-persist block
 * (local `pending_provider` row insert -> `billing.checkout.create({ mode:
 * 'payment' })` -> `checkoutUrl`/`MISSING_INIT_POINT` guard -> polling
 * schedule) was refactored to delegate to the shared `createAnnualSubscription`
 * helper (HOS-123 T-001). This test guards the WIRING itself — that the
 * resolved plan/price/urls/customerId/statementDescriptor are threaded
 * through to the helper unchanged, and that the helper's result is returned
 * as-is — independent of the helper's own unit tests
 * (`test/services/billing/create-annual-subscription.test.ts`), which cover
 * the helper's internal behavior in isolation with the real implementation.
 *
 * @module test/services/subscription-checkout-annual-wiring
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAnnualSubscriptionMock = vi.fn();
vi.mock('../../src/services/billing/create-annual-subscription', () => ({
    createAnnualSubscription: (...args: unknown[]) => createAnnualSubscriptionMock(...args)
}));

import { initiatePaidAnnualSubscription } from '../../src/services/subscription-checkout.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_owner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const ANNUAL_PRICE_ID = 'price_annual_1';
const PLAN_METADATA = { displayName: 'Premium' };

const ANNUAL_URLS = {
    successUrl: 'https://hospeda.test/billing/return?ref=local',
    cancelUrl: 'https://hospeda.test/billing/return?ref=local&cancelled=1',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

function createBillingMock() {
    return {
        plans: {
            list: vi.fn().mockResolvedValue({
                data: [
                    {
                        id: PLAN_ID,
                        name: 'owner-premium',
                        metadata: PLAN_METADATA,
                        prices: [
                            {
                                id: ANNUAL_PRICE_ID,
                                billingInterval: 'year',
                                intervalCount: 1,
                                active: true,
                                unitAmount: 35_000_000
                            }
                        ]
                    }
                ]
            })
        },
        // The plain (non-promo) path never reaches billing.customers.get in
        // the caller anymore — that lookup now lives entirely inside the
        // (mocked-away) helper — so this stub is never invoked here.
        customers: { get: vi.fn() },
        checkout: { create: vi.fn() },
        getStorage: vi.fn(() => ({}))
    };
}

function makeStubDb() {
    return {
        insert() {
            throw new Error(
                'db.insert must not be called directly by initiatePaidAnnualSubscription anymore — it belongs to createAnnualSubscription'
            );
        }
    } as unknown as Parameters<typeof initiatePaidAnnualSubscription>[0]['db'];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initiatePaidAnnualSubscription wiring to createAnnualSubscription (HOS-123 T-002)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls createAnnualSubscription with the resolved plan/price/urls/customerId and returns its result verbatim', async () => {
        createAnnualSubscriptionMock.mockResolvedValue({
            checkoutUrl: 'https://mp.test/checkout/annual-wired',
            localSubscriptionId: 'sub-wired-1',
            expiresAt: '2030-01-01T00:00:00.000Z'
        });
        const billing = createBillingMock();

        const result = await initiatePaidAnnualSubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as unknown as Parameters<
                typeof initiatePaidAnnualSubscription
            >[0]['billing'],
            urls: ANNUAL_URLS,
            statementDescriptor: 'HOSPEDA',
            db: makeStubDb()
        });

        expect(createAnnualSubscriptionMock).toHaveBeenCalledTimes(1);
        const call = createAnnualSubscriptionMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.billing).toBe(billing);
        expect(call.customerId).toBe(CUSTOMER_ID);
        expect(call.plan).toMatchObject({
            id: PLAN_ID,
            name: 'owner-premium',
            metadata: PLAN_METADATA
        });
        expect(call.priceId).toBe(ANNUAL_PRICE_ID);
        expect(call.chargeAmountCentavos).toBe(35_000_000);
        expect(call.urls).toEqual(ANNUAL_URLS);
        expect(call.statementDescriptor).toBe('HOSPEDA');
        expect(typeof call.localSubscriptionId).toBe('string');
        const metadata = call.metadata as Record<string, unknown>;
        expect(metadata.planSlug).toBe('owner-premium');
        expect(metadata.source).toBe('start-paid-annual');

        // The helper's result is returned verbatim (no local recomputation).
        expect(result.checkoutUrl).toBe('https://mp.test/checkout/annual-wired');
        expect(result.localSubscriptionId).toBe('sub-wired-1');
        expect(result.expiresAt).toBe('2030-01-01T00:00:00.000Z');
        expect(result.appliedEffect).toBeUndefined();

        // No customer lookup left in the caller for the plain (non-promo) path.
        expect(billing.customers.get).not.toHaveBeenCalled();
        expect(billing.checkout.create).not.toHaveBeenCalled();
    });

    it('omits statementDescriptor from the helper call when not provided', async () => {
        createAnnualSubscriptionMock.mockResolvedValue({
            checkoutUrl: 'https://mp.test/checkout/annual-wired-2',
            localSubscriptionId: 'sub-wired-2',
            expiresAt: '2030-01-01T00:00:00.000Z'
        });
        const billing = createBillingMock();

        await initiatePaidAnnualSubscription({
            customerId: CUSTOMER_ID,
            planSlug: 'owner-premium',
            billing: billing as unknown as Parameters<
                typeof initiatePaidAnnualSubscription
            >[0]['billing'],
            urls: ANNUAL_URLS,
            db: makeStubDb()
        });

        const call = createAnnualSubscriptionMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(call.statementDescriptor).toBeUndefined();
    });
});
