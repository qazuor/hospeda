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
 * `createOwnPreapprovalSubscription` is mocked at its module boundary, so what
 * this file proves is the WIRING — which values reach the MercadoPago plan
 * resolver, the preapproval creator and the purchase row. What that mock makes
 * IMPOSSIBLE to see from here is what qzpay-core and the Drizzle storage
 * adapter then write onto the subscription row; the borrowed-trial regression
 * lives below that line and is pinned by
 * `addon.checkout.recurring-borrowed-trial.test.ts`, which drives the real
 * `createOwnPreapprovalSubscription` over a real `QZPayBilling`.
 *
 * @module test/services/addon.checkout.recurring-flag-on
 */

import { type QZPayBilling, QZPayProviderSyncError } from '@qazuor/qzpay-core';
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
    mockPurchaseUpdateSet,
    mockPurchaseUpdateWhere,
    mockDbExecute,
    mockSelectDispatch,
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
    mockPurchaseUpdateSet: vi.fn<(values: Record<string, unknown>) => unknown>(),
    mockPurchaseUpdateWhere: vi.fn<() => Promise<void>>(),
    mockDbExecute: vi.fn<() => Promise<{ rows: Array<Record<string, unknown>> }>>(),
    /** Answers a `select()` by the shape of the projection it asked for. */
    mockSelectDispatch: vi.fn<(columns: Record<string, unknown>) => Promise<unknown[]>>(),
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
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        addonSlug: 'addon_slug',
        status: 'status',
        deletedAt: 'deleted_at',
        createdAt: 'created_at',
        mpSubscriptionId: 'mp_subscription_id'
    },
    featuredListingAddonGrants: { id: 'id' }
}));

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();

    /**
     * Minimal Drizzle-shaped builder. `select()` is answered by
     * {@link mockSelectDispatch}, keyed on the projection the caller asked for —
     * the three reads on this path project disjoint column sets, so the shape
     * identifies the query without needing a SQL engine.
     */
    const db = {
        insert: vi.fn(() => ({ values: mockPurchaseInsertValues })),
        update: vi.fn(() => ({ set: mockPurchaseUpdateSet })),
        execute: mockDbExecute,
        select: vi.fn((columns: Record<string, unknown>) => {
            const rows = () => mockSelectDispatch(columns);
            const terminal = {
                limit: async () => await rows(),
                orderBy: () => ({ limit: async () => await rows() })
            };
            return { from: () => ({ where: () => terminal }) };
        })
    };

    return {
        ...actual,
        AccommodationModel: vi.fn().mockImplementation(function () {
            return { findById: mockAccommodationFindById };
        }),
        getDb: vi.fn(() => db)
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
import { createRecurringAddonCheckout } from '../../src/services/addon.checkout.recurring';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_recurring';
const CUSTOMER_EMAIL = 'host@hospeda.test';
const USER_ID = 'user_recurring';
const HOST_PLAN_ID = '00000000-0000-4000-8000-00000000plan';
const HOST_PRICE_ID = 'price_monthly_owner';
/** The customer's PLAN subscription — what `subscription_id` must record. */
const HOST_SUBSCRIPTION_ID = 'sub_owner_001';
/** The add-on's OWN preapproval row — what `subscription_id` must NOT record. */
const ADDON_SUBSCRIPTION_ID = 'sub_addon_001';
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

/**
 * What the fake `select()` answers with. Mutated per test; every field maps to
 * one of the three reads the recurring path performs.
 */
const dbState = {
    /** `billing_addons.billing_interval` for the add-on under test. */
    addonBillingInterval: 'month' as string | null,
    /** The `'pending'` `billing_addon_purchases` rows for this customer + add-on. */
    pendingPurchases: [] as Array<Record<string, unknown>>,
    /** The `billing_subscriptions` rows reachable by `mp_subscription_id`. */
    subscriptions: [] as Array<Record<string, unknown>>
};

function createBilling(): QZPayBilling {
    return {
        customers: {
            get: vi.fn().mockResolvedValue({
                id: CUSTOMER_ID,
                email: CUSTOMER_EMAIL,
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
            getPrices: vi.fn().mockResolvedValue([
                {
                    id: HOST_PRICE_ID,
                    active: true,
                    billingInterval: 'month',
                    intervalCount: 1
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

/** Read the single input object handed to `createOwnPreapprovalSubscription`. */
function readPreapprovalInput(): Record<string, unknown> {
    expect(mockCreateOwnPreapprovalSubscription).toHaveBeenCalledTimes(1);
    return mockCreateOwnPreapprovalSubscription.mock.calls[0]?.[0] as Record<string, unknown>;
}

describe('createAddonCheckout — recurring path (HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED=true)', () => {
    let billing: QZPayBilling;

    beforeEach(() => {
        vi.clearAllMocks();

        billing = createBilling();

        dbState.addonBillingInterval = 'month';
        dbState.pendingPurchases = [];
        dbState.subscriptions = [];

        mockSelectDispatch.mockImplementation(async (columns: Record<string, unknown>) => {
            const keys = Object.keys(columns);
            if (keys.length === 1 && keys[0] === 'billingInterval') {
                return dbState.addonBillingInterval === null
                    ? [{ billingInterval: null }]
                    : [{ billingInterval: dbState.addonBillingInterval }];
            }
            if (keys.includes('mpSubscriptionId')) {
                return dbState.pendingPurchases;
            }
            if (keys.includes('metadata') && keys.includes('createdAt')) {
                return dbState.subscriptions;
            }
            throw new Error(`unexpected select projection: ${keys.join(',')}`);
        });

        // No cached `mp_payer_email` by default — the signup address is used.
        mockDbExecute.mockResolvedValue({ rows: [] });

        mockAddonCatalogGetBySlug.mockImplementation(async (slug: string) => {
            if (slug === RECURRING_ADDON.slug) return { success: true, data: RECURRING_ADDON };
            if (slug === ONE_TIME_ADDON.slug) return { success: true, data: ONE_TIME_ADDON };
            return { success: false, error: { code: 'NOT_FOUND', message: 'nope' } };
        });

        // Resolves for real now: the recurring path reads the plan through
        // `PlanService` (the same dual-resolve the `targetCategories` gate uses)
        // instead of qzpay's livemode-filtered `plans.listAll()`.
        mockPlanServiceGetById.mockResolvedValue({
            success: true,
            data: { id: HOST_PLAN_ID, slug: 'owner-premium', category: 'owner' }
        });
        mockPlanServiceGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND' }
        });

        mockAccommodationFindById.mockResolvedValue(null);

        mockResolveCheckoutMpAddonPlanId.mockResolvedValue(MP_ADDON_PLAN_ID);
        mockCreateOwnPreapprovalSubscription.mockResolvedValue({
            subscription: {
                id: ADDON_SUBSCRIPTION_ID,
                providerSubscriptionIds: { mercadopago: MP_PREAPPROVAL_ID }
            },
            checkoutUrl: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=x'
        });

        mockPurchaseInsertReturning.mockResolvedValue([{ id: 'purchase_recurring_001' }]);
        mockPurchaseInsertValues.mockImplementation(() => ({
            returning: mockPurchaseInsertReturning
        }));
        mockPurchaseUpdateWhere.mockResolvedValue(undefined);
        mockPurchaseUpdateSet.mockImplementation(() => ({ where: mockPurchaseUpdateWhere }));

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

        const created = readPreapprovalInput();
        // Without this the preapproval would charge the HOST PLAN's amount.
        expect(created.providerPriceId).toBe(MP_ADDON_PLAN_ID);
        // Without this the row defaults to 'accommodation', which
        // `subscriptionMatchesDomain` fails OPEN on — the add-on's preapproval
        // would be counted as the owner's own subscription.
        expect(created.productDomain).toBe(ProductDomainEnum.ADDON);
        expect(created.billingInterval).toBe('monthly');
        // qzpay refuses `mode: 'paid'` without a resolvable plan + price; the
        // add-on borrows the customer's.
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

    it("states a ZERO local trial rather than inheriting the borrowed price's", async () => {
        await createAddonCheckout(billing, INPUT);

        // The wiring half of the borrowed-trial fix. Omitted, qzpay-core falls
        // through to the borrowed price's `trialDays` — 30 on the owner monthly
        // price since data-migration 0055 — and the add-on's row would be born
        // claiming a trial MercadoPago never granted. What that inheritance
        // actually writes is asserted in
        // `addon.checkout.recurring-borrowed-trial.test.ts`; this only proves
        // the value is stated at all.
        expect(readPreapprovalInput().trialDays).toBe(0);
    });

    it('binds the preapproval to the cached MercadoPago payer email, not the signup one', async () => {
        // HOS-208: a host whose MercadoPago account lives under another address.
        // `payer_email` is BINDING — only that exact address can authorize.
        mockDbExecute.mockResolvedValue({ rows: [{ mp_payer_email: 'maria.pagos@gmail.com' }] });

        await createAddonCheckout(billing, INPUT);

        expect(readPreapprovalInput().payerEmail).toBe('maria.pagos@gmail.com');
    });

    it('falls back to the billing account email when nothing is cached', async () => {
        await createAddonCheckout(billing, INPUT);

        expect(readPreapprovalInput().payerEmail).toBe(CUSTOMER_EMAIL);
    });

    it("refuses when the resolved payer email carries a '+' MercadoPago rejects", async () => {
        mockDbExecute.mockResolvedValue({ rows: [{ mp_payer_email: 'maria+hospeda@gmail.com' }] });

        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('ADDON_PAYER_EMAIL_UNSUPPORTED');
        expect(mockCreateOwnPreapprovalSubscription).not.toHaveBeenCalled();
        expect(mockPurchaseInsertValues).not.toHaveBeenCalled();
    });

    it("writes the purchase row 'pending' with its preapproval id, and grants nothing", async () => {
        await createAddonCheckout(billing, INPUT);

        const row = readInsertedPurchaseRow();
        // Born pending: the benefit is applied by the webhook (PR 5). Writing
        // 'active' here would hand the add-on to anyone who abandons the
        // MercadoPago authorization page.
        expect(row.status).toBe('pending');
        expect(row.mpSubscriptionId).toBe(MP_PREAPPROVAL_ID);
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

    it('records the PLAN subscription in subscription_id, never the add-on preapproval', async () => {
        await createAddonCheckout(billing, INPUT);

        const row = readInsertedPurchaseRow();

        // `billing_addon_purchases.subscription_id` means "the plan subscription
        // this add-on runs on top of", and four readers depend on that meaning:
        //   apps/api/src/services/addon-lifecycle-cancellation.service.ts:147
        //   apps/api/src/routes/billing/admin/qzpay-admin-hooks.ts:186 and :318
        //   apps/api/src/cron/jobs/addon-expiry.job.ts:847-857 (INNER JOIN)
        // Writing the add-on's OWN preapproval row here makes all four match
        // zero rows: cancelling the plan logs "skipping cleanup", the limit
        // stays granted forever, and once PR 6 hangs the MercadoPago
        // hard-cancel off that same query the preapproval is never cancelled
        // and keeps charging. That is risk R1 / HOS-751.
        expect(row.subscriptionId).toBe(HOST_SUBSCRIPTION_ID);
        expect(row.subscriptionId).not.toBe(ADDON_SUBSCRIPTION_ID);

        // The add-on's own preapproval is not lost — it lives in the column
        // that means that.
        expect(row.mpSubscriptionId).toBe(MP_PREAPPROVAL_ID);
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

    it('surfaces a provisioning failure as a provider error and creates no preapproval', async () => {
        mockResolveCheckoutMpAddonPlanId.mockRejectedValue(new Error('MP said no'));

        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('ADDON_PROVIDER_ERROR');
        expect(mockCreateOwnPreapprovalSubscription).not.toHaveBeenCalled();
        expect(mockPurchaseInsertValues).not.toHaveBeenCalled();
    });

    it('lets a real MercadoPago failure reach the Sentry capture, not just a log line', async () => {
        // The one-time path re-throws `QZPayProviderSyncError` so
        // `createAddonCheckout`'s catch maps it (502/503/504) AND calls
        // `captureBillingError`. Converting it to a typed `ServiceResult` here
        // would keep every recurring-path MercadoPago outage out of Sentry —
        // an asymmetry with no reason behind it.
        const providerError = new QZPayProviderSyncError(
            'MercadoPago rejected the preapproval',
            'mercadopago',
            'create_subscription'
        );
        mockCreateOwnPreapprovalSubscription.mockRejectedValue(providerError);

        await expect(createAddonCheckout(billing, INPUT)).rejects.toThrow();
        expect(mockPurchaseInsertValues).not.toHaveBeenCalled();
    });

    it('does the same for a provider failure while provisioning the MP plan', async () => {
        mockResolveCheckoutMpAddonPlanId.mockRejectedValue(
            new QZPayProviderSyncError('MercadoPago is down', 'mercadopago', 'create_plan')
        );

        await expect(createAddonCheckout(billing, INPUT)).rejects.toThrow();
        expect(mockCreateOwnPreapprovalSubscription).not.toHaveBeenCalled();
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
        expect(mockSubscriptionsCancel).toHaveBeenCalledWith(ADDON_SUBSCRIPTION_ID);
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

    it("refuses with a 422-family code when the customer's plan resolves to no plan/price", async () => {
        mockPlanServiceGetById.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND' } });

        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(false);
        // Not `CHECKOUT_ERROR`: that maps to 500 INTERNAL_ERROR, pages on-call
        // for a data condition, and hides the cause from the operator.
        expect(result.error?.code).toBe('RECURRING_ADDON_PLAN_UNRESOLVED');
        expect(mockCreateOwnPreapprovalSubscription).not.toHaveBeenCalled();
    });
});

describe("recurring gate — the catalog row's real billing_interval decides", () => {
    let billing: QZPayBilling;

    beforeEach(() => {
        vi.clearAllMocks();
        billing = createBilling();
        dbState.addonBillingInterval = 'month';
        dbState.pendingPurchases = [];
        dbState.subscriptions = [];
        mockSelectDispatch.mockImplementation(async (columns: Record<string, unknown>) => {
            const keys = Object.keys(columns);
            if (keys.length === 1 && keys[0] === 'billingInterval') {
                return [{ billingInterval: dbState.addonBillingInterval }];
            }
            if (keys.includes('mpSubscriptionId')) return dbState.pendingPurchases;
            return dbState.subscriptions;
        });
        mockDbExecute.mockResolvedValue({ rows: [] });
        mockAddonCatalogGetBySlug.mockResolvedValue({ success: true, data: RECURRING_ADDON });
        mockPlanServiceGetById.mockResolvedValue({
            success: true,
            data: { id: HOST_PLAN_ID, slug: 'owner-premium', category: 'owner' }
        });
        mockPlanServiceGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND' }
        });
        mockAccommodationFindById.mockResolvedValue(null);
        mockResolveCheckoutMpAddonPlanId.mockResolvedValue(MP_ADDON_PLAN_ID);
        mockBillingCheckoutCreate.mockResolvedValue({
            id: 'session_one_time',
            providerInitPoint: 'https://www.mercadopago.com.ar/checkout/one-time',
            expiresAt: new Date('2030-01-01T00:30:00Z')
        });
        mockPollingJobsCreate.mockResolvedValue({ id: 'poll_1', nextPollAt: new Date() });
        mockPurchaseInsertReturning.mockResolvedValue([{ id: 'purchase_x' }]);
        mockPurchaseInsertValues.mockImplementation(() => ({
            returning: mockPurchaseInsertReturning
        }));
    });

    // `addon-catalog.mapper.ts`'s `resolveBillingType` returns 'recurring' for
    // ANYTHING that is not the literal 'one_time' — NULL, '', a typo an operator
    // enters through the SPEC-168 admin UI. Until this PR that was cosmetic;
    // now it decides between one charge and a perpetual one, so the gate asks
    // the real column for a POSITIVE 'month' and everything else falls back.
    for (const interval of [null, '', 'monthly', 'one_time']) {
        it(`falls back to the one-time path when billing_interval is ${JSON.stringify(interval)}`, async () => {
            dbState.addonBillingInterval = interval;

            const result = await createAddonCheckout(billing, INPUT);

            expect(result.success).toBe(true);
            expect(mockBillingCheckoutCreate).toHaveBeenCalledTimes(1);
            expect(mockBillingCheckoutCreate.mock.calls[0]?.[0]?.mode).toBe('payment');
            expect(mockResolveCheckoutMpAddonPlanId).not.toHaveBeenCalled();
            expect(mockCreateOwnPreapprovalSubscription).not.toHaveBeenCalled();
        });
    }

    it('falls back to the one-time path when the catalog row cannot be read at all', async () => {
        mockSelectDispatch.mockRejectedValue(new Error('db is down'));

        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(true);
        expect(mockBillingCheckoutCreate.mock.calls[0]?.[0]?.mode).toBe('payment');
        expect(mockCreateOwnPreapprovalSubscription).not.toHaveBeenCalled();
    });

    it('falls back to the one-time path for a catalog row with no id to verify', async () => {
        mockAddonCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: { ...RECURRING_ADDON, id: undefined }
        });

        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(true);
        expect(mockBillingCheckoutCreate.mock.calls[0]?.[0]?.mode).toBe('payment');
        expect(mockResolveCheckoutMpAddonPlanId).not.toHaveBeenCalled();
    });

    it('still refuses an id-less add-on when the recurring module is called directly', async () => {
        // Backstop for any caller that is not `createAddonCheckout`. 422 family,
        // not `CHECKOUT_ERROR` → 500: "this row cannot be sold recurringly" is a
        // data condition, not our runtime failing.
        const result = await createRecurringAddonCheckout({
            billing,
            addon: { ...RECURRING_ADDON, id: undefined } as never,
            customerId: CUSTOMER_ID,
            customerEmail: CUSTOMER_EMAIL,
            userId: USER_ID,
            planSubscription: { id: HOST_SUBSCRIPTION_ID, planId: HOST_PLAN_ID },
            orderId: 'addon_extra-photos-20_x',
            successUrl: 'https://hospeda.test/es/mi-cuenta/addons/',
            notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('RECURRING_ADDON_NOT_SELLABLE');
        expect(mockResolveCheckoutMpAddonPlanId).not.toHaveBeenCalled();
    });
});

describe('recurring checkout idempotency — a second click must not buy a second preapproval', () => {
    let billing: QZPayBilling;

    /** A `billing_subscriptions` row as `createOwnPreapprovalSubscription` leaves it. */
    function inFlightSubscription(overrides: Record<string, unknown> = {}) {
        return {
            id: ADDON_SUBSCRIPTION_ID,
            customerId: CUSTOMER_ID,
            status: 'pending_provider',
            metadata: {
                checkoutUrl: 'https://www.mercadopago.com.ar/subscriptions/checkout?first=1',
                mpPreapprovalPlanId: MP_ADDON_PLAN_ID
            },
            createdAt: new Date(Date.now() - 60_000),
            ...overrides
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        billing = createBilling();
        dbState.addonBillingInterval = 'month';
        dbState.pendingPurchases = [
            {
                id: 'purchase_pending_001',
                customerId: CUSTOMER_ID,
                mpSubscriptionId: MP_PREAPPROVAL_ID
            }
        ];
        dbState.subscriptions = [inFlightSubscription()];

        mockSelectDispatch.mockImplementation(async (columns: Record<string, unknown>) => {
            const keys = Object.keys(columns);
            if (keys.length === 1 && keys[0] === 'billingInterval') {
                return [{ billingInterval: dbState.addonBillingInterval }];
            }
            if (keys.includes('mpSubscriptionId')) return dbState.pendingPurchases;
            return dbState.subscriptions;
        });
        mockDbExecute.mockResolvedValue({ rows: [] });
        mockAddonCatalogGetBySlug.mockResolvedValue({ success: true, data: RECURRING_ADDON });
        mockPlanServiceGetById.mockResolvedValue({
            success: true,
            data: { id: HOST_PLAN_ID, slug: 'owner-premium', category: 'owner' }
        });
        mockPlanServiceGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND' }
        });
        mockAccommodationFindById.mockResolvedValue(null);
        mockResolveCheckoutMpAddonPlanId.mockResolvedValue(MP_ADDON_PLAN_ID);
        mockCreateOwnPreapprovalSubscription.mockResolvedValue({
            subscription: {
                id: 'sub_addon_second',
                providerSubscriptionIds: { mercadopago: 'preapproval_addon_002' }
            },
            checkoutUrl: 'https://www.mercadopago.com.ar/subscriptions/checkout?second=1'
        });
        mockPurchaseInsertReturning.mockResolvedValue([{ id: 'purchase_recurring_002' }]);
        mockPurchaseInsertValues.mockImplementation(() => ({
            returning: mockPurchaseInsertReturning
        }));
        mockPurchaseUpdateWhere.mockResolvedValue(undefined);
        mockPurchaseUpdateSet.mockImplementation(() => ({ where: mockPurchaseUpdateWhere }));
        mockSubscriptionsCancel.mockResolvedValue(undefined);
    });

    it('hands back the ORIGINAL checkout URL instead of opening a second preapproval', async () => {
        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(true);
        expect(result.data?.checkoutUrl).toBe(
            'https://www.mercadopago.com.ar/subscriptions/checkout?first=1'
        );
        // The whole point: nothing chargeable was created, and no second
        // 'pending' row was written (the partial unique index would not have
        // stopped one — it only covers status='active').
        expect(mockCreateOwnPreapprovalSubscription).not.toHaveBeenCalled();
        expect(mockPurchaseInsertValues).not.toHaveBeenCalled();
        expect(mockSubscriptionsCancel).not.toHaveBeenCalled();
    });

    it('closes the stale checkout before opening a new one when the MP plan drifted', async () => {
        dbState.subscriptions = [
            inFlightSubscription({
                metadata: {
                    checkoutUrl: 'https://www.mercadopago.com.ar/subscriptions/checkout?first=1',
                    mpPreapprovalPlanId: 'a-different-mp-plan'
                }
            })
        ];

        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(true);
        expect(result.data?.checkoutUrl).toBe(
            'https://www.mercadopago.com.ar/subscriptions/checkout?second=1'
        );
        // Cancelled at MercadoPago FIRST, then the row closed — never two live
        // preapprovals for one add-on.
        expect(mockSubscriptionsCancel).toHaveBeenCalledWith(ADDON_SUBSCRIPTION_ID);
        expect(mockPurchaseUpdateSet).toHaveBeenCalledTimes(1);
        expect(mockPurchaseUpdateSet.mock.calls[0]?.[0]?.status).toBe('canceled');
        expect(mockCreateOwnPreapprovalSubscription).toHaveBeenCalledTimes(1);
    });

    it('closes the stale checkout when the reuse window has elapsed', async () => {
        dbState.subscriptions = [
            inFlightSubscription({ createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000) })
        ];

        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(true);
        expect(mockSubscriptionsCancel).toHaveBeenCalledWith(ADDON_SUBSCRIPTION_ID);
        expect(mockCreateOwnPreapprovalSubscription).toHaveBeenCalledTimes(1);
    });

    it('refuses rather than opening a second preapproval when the stale one cannot be cancelled', async () => {
        dbState.subscriptions = [
            inFlightSubscription({ createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000) })
        ];
        mockSubscriptionsCancel.mockRejectedValue(new Error('MercadoPago is down'));

        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('ADDON_CHECKOUT_IN_FLIGHT');
        expect(mockCreateOwnPreapprovalSubscription).not.toHaveBeenCalled();
        expect(mockPurchaseInsertValues).not.toHaveBeenCalled();
    });

    it('refuses when the in-flight lookup itself fails, rather than guessing', async () => {
        mockSelectDispatch.mockImplementation(async (columns: Record<string, unknown>) => {
            const keys = Object.keys(columns);
            if (keys.length === 1 && keys[0] === 'billingInterval') {
                return [{ billingInterval: 'month' }];
            }
            throw new Error('db is down');
        });

        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('ADDON_CHECKOUT_IN_FLIGHT');
        expect(mockCreateOwnPreapprovalSubscription).not.toHaveBeenCalled();
    });

    it('proceeds normally when nothing is in flight', async () => {
        dbState.pendingPurchases = [];

        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(true);
        expect(mockCreateOwnPreapprovalSubscription).toHaveBeenCalledTimes(1);
        expect(mockSubscriptionsCancel).not.toHaveBeenCalled();
    });
});
