/**
 * `createAddonCheckout` with the HOS-847 PR 4 recurring flag ON
 * (`HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED = true`).
 *
 * Kept in its own file because `env` is read at module scope: flipping the flag
 * per-file is what the `subscription-checkout-own-preapproval-flag-{on,off}`
 * pair does, and it avoids `vi.resetModules()` gymnastics. Its twin,
 * `addon.checkout.recurring-flag-off.test.ts`, holds the assertion this file
 * cannot make — that with the flag unset the one-time `Preference` path is
 * still the one that runs.
 *
 * The two collaborators are mocked at their module boundary on purpose. What is
 * under test here is the WIRING — which values reach the MercadoPago plan
 * resolver, the preapproval creator and the purchase row — not their internals,
 * which are covered by `billing/mp-addon-plan-provisioning.test.ts` and the
 * own-preapproval suites.
 *
 * @module test/services/addon.checkout.recurring-flag-on
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { ProductDomainEnum } from '@repo/schemas';
import type { PurchaseAddonInput } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
    mockAddonCatalogGetBySlug,
    mockPlanServiceGetById,
    mockPlanServiceGetBySlug,
    mockAccommodationFindById,
    mockResolveCheckoutMpAddonPlanId,
    mockCreateOwnPreapprovalSubscription,
    mockPurchaseInsertValues,
    mockPurchaseInsertReturning,
    mockBillingCheckoutCreate,
    mockPollingJobsCreate,
    mockSubscriptionsCancel,
    mockPromoValidate,
    mockPromoGetByCode
} = vi.hoisted(() => ({
    mockAddonCatalogGetBySlug: vi.fn(),
    mockPlanServiceGetById: vi.fn(),
    mockPlanServiceGetBySlug: vi.fn(),
    mockAccommodationFindById: vi.fn(),
    mockResolveCheckoutMpAddonPlanId: vi.fn<(input: Record<string, unknown>) => Promise<string>>(),
    mockCreateOwnPreapprovalSubscription:
        vi.fn<(input: Record<string, unknown>) => Promise<unknown>>(),
    mockPurchaseInsertValues: vi.fn<(values: Record<string, unknown>) => unknown>(),
    mockPurchaseInsertReturning: vi.fn<() => Promise<Array<{ id: string }>>>(),
    mockBillingCheckoutCreate: vi.fn(),
    mockPollingJobsCreate: vi.fn(),
    mockSubscriptionsCancel: vi.fn<(id: string) => Promise<void>>(),
    mockPromoValidate: vi.fn(),
    mockPromoGetByCode: vi.fn()
}));

vi.mock('../../src/utils/env', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA',
        HOSPEDA_BILLING_POLLING_ENABLED: true,
        // The whole point of this file.
        HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED: true
    }
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/services/billing/orphan-payment-queue.service', () => ({
    recordOrphanPayment: vi.fn()
}));

vi.mock('../../src/services/billing/mp-addon-plan-provisioning.service', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../src/services/billing/mp-addon-plan-provisioning.service')
        >();
    return { ...actual, resolveCheckoutMpAddonPlanId: mockResolveCheckoutMpAddonPlanId };
});

vi.mock('../../src/services/billing/own-preapproval-subscription-create', () => ({
    createOwnPreapprovalSubscription: mockCreateOwnPreapprovalSubscription
}));

vi.mock('../../src/services/promo-code.service', () => ({
    PromoCodeService: vi.fn().mockImplementation(function () {
        return { validate: mockPromoValidate, getByCode: mockPromoGetByCode };
    })
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: { id: 'id' },
    featuredListingAddonGrants: { id: 'id' }
}));

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        AccommodationModel: vi.fn().mockImplementation(function () {
            return { findById: mockAccommodationFindById };
        }),
        getDb: vi.fn(() => ({
            insert: vi.fn(() => ({ values: mockPurchaseInsertValues }))
        }))
    };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        PlanService: vi.fn().mockImplementation(function () {
            return { getById: mockPlanServiceGetById, getBySlug: mockPlanServiceGetBySlug };
        }),
        AddonCatalogService: vi.fn().mockImplementation(function () {
            return { getBySlug: mockAddonCatalogGetBySlug };
        }),
        // `getByCustomerId()` never carries `productDomain`; the real helper
        // recovers it from the row. `@repo/db` is mocked wholesale here, so it
        // has no query builder to run against. Fills only an UNDEFINED value —
        // an explicit one on a fixture must survive, exactly as the real
        // function behaves.
        hydrateSubscriptionProductDomains: vi.fn(async (subs: readonly Record<string, unknown>[]) =>
            subs.map((sub) => ({
                ...sub,
                productDomain: sub.productDomain === undefined ? 'accommodation' : sub.productDomain
            }))
        )
    };
});

import { createAddonCheckout } from '../../src/services/addon.checkout';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_recurring';
const USER_ID = 'user_recurring';
const HOST_PLAN_ID = '00000000-0000-4000-8000-00000000plan';
const HOST_PRICE_ID = 'price_monthly_owner';
const HOST_SUBSCRIPTION_ID = 'sub_owner_001';
const ADDON_UUID = '00000000-0000-4000-8000-0000000adds1';
const MP_ADDON_PLAN_ID = '2c93808491e2fcbf0191ea1c9f1b0000';
const MP_PREAPPROVAL_ID = 'preapproval_addon_001';
const ADDON_LIST_PRICE_CENTAVOS = 500_000;

const RECURRING_ADDON = {
    id: ADDON_UUID,
    slug: 'extra-photos-20',
    name: 'Extra Photos Pack (+20 photos)',
    description: 'Adds 20 additional photos.',
    billingType: 'recurring' as const,
    priceArs: ADDON_LIST_PRICE_CENTAVOS,
    annualPriceArs: 4_800_000,
    durationDays: null,
    isActive: true,
    targetCategories: ['owner'] as const,
    productDomain: ProductDomainEnum.ACCOMMODATION,
    sortOrder: 3,
    affectsLimitKey: 'max_photos_per_accommodation',
    limitIncrease: 20,
    grantsEntitlement: null
};

const ONE_TIME_ADDON = {
    ...RECURRING_ADDON,
    id: '00000000-0000-4000-8000-0000000adds2',
    slug: 'visibility-boost-7d',
    name: 'Visibility Boost (7 days)',
    billingType: 'one_time' as const,
    annualPriceArs: null,
    durationDays: 7,
    affectsLimitKey: null,
    limitIncrease: null,
    grantsEntitlement: 'featured_listing'
};

const INPUT: PurchaseAddonInput = {
    customerId: CUSTOMER_ID,
    addonSlug: RECURRING_ADDON.slug,
    userId: USER_ID
};

function createBilling(): QZPayBilling {
    return {
        customers: {
            get: vi.fn().mockResolvedValue({
                id: CUSTOMER_ID,
                email: 'host@hospeda.test',
                metadata: { name: 'Maria Rodriguez' }
            })
        },
        subscriptions: {
            getByCustomerId: vi
                .fn()
                .mockResolvedValue([
                    { id: HOST_SUBSCRIPTION_ID, status: 'active', planId: HOST_PLAN_ID }
                ]),
            cancel: mockSubscriptionsCancel
        },
        plans: {
            listAll: vi.fn().mockResolvedValue([
                {
                    id: HOST_PLAN_ID,
                    name: 'owner-premium',
                    prices: [
                        {
                            id: HOST_PRICE_ID,
                            active: true,
                            billingInterval: 'month',
                            intervalCount: 1
                        }
                    ]
                }
            ])
        },
        checkout: { create: mockBillingCheckoutCreate },
        getStorage: vi
            .fn()
            .mockReturnValue({ subscriptionPollingJobs: { create: mockPollingJobsCreate } })
    } as unknown as QZPayBilling;
}

/** Read the single `values({...})` object handed to the purchase INSERT. */
function readInsertedPurchaseRow(): Record<string, unknown> {
    expect(mockPurchaseInsertValues).toHaveBeenCalledTimes(1);
    return mockPurchaseInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
}

describe('createAddonCheckout — recurring path (HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED=true)', () => {
    let billing: QZPayBilling;

    beforeEach(() => {
        vi.clearAllMocks();

        billing = createBilling();

        mockAddonCatalogGetBySlug.mockImplementation(async (slug: string) => {
            if (slug === RECURRING_ADDON.slug) return { success: true, data: RECURRING_ADDON };
            if (slug === ONE_TIME_ADDON.slug) return { success: true, data: ONE_TIME_ADDON };
            return { success: false, error: { code: 'NOT_FOUND', message: 'nope' } };
        });

        // No plan resolves -> the targetCategories gate short-circuits, which is
        // not what this file is about.
        mockPlanServiceGetById.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND' } });
        mockPlanServiceGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND' }
        });

        mockAccommodationFindById.mockResolvedValue(null);

        mockResolveCheckoutMpAddonPlanId.mockResolvedValue(MP_ADDON_PLAN_ID);
        mockCreateOwnPreapprovalSubscription.mockResolvedValue({
            subscription: {
                id: 'sub_addon_001',
                providerSubscriptionIds: { mercadopago: MP_PREAPPROVAL_ID }
            },
            checkoutUrl: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=x'
        });

        mockPurchaseInsertReturning.mockResolvedValue([{ id: 'purchase_recurring_001' }]);
        mockPurchaseInsertValues.mockImplementation(() => ({
            returning: mockPurchaseInsertReturning
        }));

        mockBillingCheckoutCreate.mockResolvedValue({
            id: 'session_never_used',
            providerInitPoint: 'https://www.mercadopago.com.ar/checkout/one-time',
            expiresAt: new Date('2030-01-01T00:30:00Z')
        });
        mockPollingJobsCreate.mockResolvedValue({ id: 'poll_1', nextPollAt: new Date() });
    });

    it('creates a preapproval instead of a one-time preference, and returns its checkout URL', async () => {
        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(true);
        expect(result.data?.checkoutUrl).toBe(
            'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=x'
        );
        expect(result.data?.addonId).toBe(RECURRING_ADDON.slug);
        expect(result.data?.amount).toBe(ADDON_LIST_PRICE_CENTAVOS);

        expect(mockCreateOwnPreapprovalSubscription).toHaveBeenCalledTimes(1);
        // The one-time path must not have run at all — not the Preference, not
        // its polling fallback (a preapproval delivers Webhooks v2; a Preference
        // does not, which is the only reason that job exists).
        expect(mockBillingCheckoutCreate).not.toHaveBeenCalled();
        expect(mockPollingJobsCreate).not.toHaveBeenCalled();
    });

    it("resolves the add-on's own MercadoPago plan at the LIST price, monthly, keyed by addon id", async () => {
        await createAddonCheckout(billing, INPUT);

        expect(mockResolveCheckoutMpAddonPlanId).toHaveBeenCalledTimes(1);
        const planInput = mockResolveCheckoutMpAddonPlanId.mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(planInput.addonId).toBe(ADDON_UUID);
        expect(planInput.amountCentavos).toBe(ADDON_LIST_PRICE_CENTAVOS);
        expect(planInput.billingInterval).toBe('monthly');
        expect(planInput.currency).toBe('ARS');
        expect(planInput.backUrl).toBe(
            'https://hospeda.test/es/mi-cuenta/addons/?status=success&addon=extra-photos-20'
        );
    });

    it("subscribes against the add-on's plan and tags the row product_domain='addon'", async () => {
        await createAddonCheckout(billing, INPUT);

        const created = mockCreateOwnPreapprovalSubscription.mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        // Without this the preapproval would charge the HOST PLAN's amount.
        expect(created.providerPriceId).toBe(MP_ADDON_PLAN_ID);
        // Without this the row defaults to 'accommodation', which
        // `subscriptionMatchesDomain` fails OPEN on — the add-on's preapproval
        // would be counted as the owner's own subscription.
        expect(created.productDomain).toBe(ProductDomainEnum.ADDON);
        expect(created.billingInterval).toBe('monthly');
        // qzpay refuses `mode: 'paid'` without a resolvable plan + price; the
        // add-on borrows the customer's, which is inert once providerPriceId is
        // set.
        expect(created.planId).toBe(HOST_PLAN_ID);
        expect(created.priceId).toBe(HOST_PRICE_ID);
        expect(created.notificationUrl).toBe(
            'https://api.hospeda.test/api/v1/webhooks/mercadopago'
        );

        const metadata = created.metadata as Record<string, unknown>;
        expect(metadata.addonSlug).toBe(RECURRING_ADDON.slug);
        expect(metadata.addonId).toBe(ADDON_UUID);
        expect(metadata.userId).toBe(USER_ID);
        expect(metadata.type).toBe('addon_purchase');
    });

    it("writes the purchase row 'pending' with its preapproval id, and grants nothing", async () => {
        await createAddonCheckout(billing, INPUT);

        const row = readInsertedPurchaseRow();
        // Born pending: the benefit is applied by the webhook (PR 5). Writing
        // 'active' here would hand the add-on to anyone who abandons the
        // MercadoPago authorization page.
        expect(row.status).toBe('pending');
        expect(row.mpSubscriptionId).toBe(MP_PREAPPROVAL_ID);
        expect(row.subscriptionId).toBe('sub_addon_001');
        expect(row.customerId).toBe(CUSTOMER_ID);
        expect(row.addonSlug).toBe(RECURRING_ADDON.slug);
        expect(row.addonId).toBe(ADDON_UUID);
        expect(row.billingInterval).toBe('monthly');
        // A recurring purchase has no fixed window; its end is
        // `current_period_end`, computed from the CONFIRMED charge in PR 5.
        expect(row.expiresAt).toBeNull();
        expect(row.limitAdjustments).toEqual([]);
        expect(row.entitlementAdjustments).toEqual([]);
    });

    it('leaves a one-time add-on on the Preference path even with the flag on', async () => {
        const result = await createAddonCheckout(billing, {
            ...INPUT,
            addonSlug: ONE_TIME_ADDON.slug,
            accommodationId: undefined
        });

        // `visibility-boost-7d` requires an accommodation target in production;
        // this fixture deliberately does not, so the checkout runs through.
        expect(result.success).toBe(true);
        expect(mockBillingCheckoutCreate).toHaveBeenCalledTimes(1);
        expect(mockBillingCheckoutCreate.mock.calls[0]?.[0]?.mode).toBe('payment');
        expect(mockCreateOwnPreapprovalSubscription).not.toHaveBeenCalled();
        expect(mockResolveCheckoutMpAddonPlanId).not.toHaveBeenCalled();
    });

    it('refuses a promo code rather than charging the full price behind it', async () => {
        const result = await createAddonCheckout(billing, { ...INPUT, promoCode: 'SAVE10' });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('RECURRING_ADDON_PROMO_UNSUPPORTED');
        // Refused BEFORE anything is created at MercadoPago.
        expect(mockResolveCheckoutMpAddonPlanId).not.toHaveBeenCalled();
        expect(mockCreateOwnPreapprovalSubscription).not.toHaveBeenCalled();
        expect(mockPurchaseInsertValues).not.toHaveBeenCalled();
    });

    it('refuses an add-on whose catalog row carries no id, before touching MercadoPago', async () => {
        mockAddonCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: { ...RECURRING_ADDON, id: undefined }
        });

        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('CHECKOUT_ERROR');
        // A blank addonId would make the registry lookup drop that column and
        // return ANOTHER add-on's plan, so this must never reach the resolver.
        expect(mockResolveCheckoutMpAddonPlanId).not.toHaveBeenCalled();
        expect(mockCreateOwnPreapprovalSubscription).not.toHaveBeenCalled();
    });

    it('surfaces a provisioning failure as a provider error and creates no preapproval', async () => {
        mockResolveCheckoutMpAddonPlanId.mockRejectedValue(new Error('MP said no'));

        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('ADDON_PROVIDER_ERROR');
        expect(mockCreateOwnPreapprovalSubscription).not.toHaveBeenCalled();
        expect(mockPurchaseInsertValues).not.toHaveBeenCalled();
    });

    it('cancels the preapproval when the pending purchase row cannot be written', async () => {
        mockPurchaseInsertReturning.mockRejectedValue(new Error('db is down'));

        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('CHECKOUT_ERROR');
        // HOS-751 class: a live preapproval with no local row keeps charging and
        // nobody can see it. PR 2 excluded add-on rows from
        // `abandoned-pending-subs`, so nothing else would reap this one.
        expect(mockSubscriptionsCancel).toHaveBeenCalledTimes(1);
        expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_addon_001');
    });

    it('cancels and refuses when the provider returns no preapproval id', async () => {
        mockCreateOwnPreapprovalSubscription.mockResolvedValue({
            subscription: { id: 'sub_addon_002', providerSubscriptionIds: {} },
            checkoutUrl: 'https://www.mercadopago.com.ar/subscriptions/checkout'
        });

        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('ADDON_PROVIDER_ERROR');
        expect(mockPurchaseInsertValues).not.toHaveBeenCalled();
        expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_addon_002');
    });

    it("refuses when the customer's plan cannot be resolved to a plan/price pair", async () => {
        (
            billing.plans as unknown as { listAll: ReturnType<typeof vi.fn> }
        ).listAll.mockResolvedValue([]);

        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('CHECKOUT_ERROR');
        expect(mockCreateOwnPreapprovalSubscription).not.toHaveBeenCalled();
    });
});
