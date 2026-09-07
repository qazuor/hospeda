/**
 * `createAddonCheckout` with the HOS-847 PR 4 recurring flag OFF
 * (`HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED` unset — the production default,
 * and the value every environment has today).
 *
 * The existing `addon.checkout.test.ts` suite already covers the one-time
 * `Preference` path end to end, and its own fixture add-on
 * (`extra-photos-20`) is a RECURRING one, so it is already a regression guard
 * for this. What it cannot assert is the thing this file exists for: that
 * `createRecurringAddonCheckout` is never reached — it does not import the
 * module. Kept separate from the flag-ON twin because `env` is read at module
 * scope.
 *
 * `shouldUseRecurringAddonCheckout` is deliberately NOT mocked: the decision
 * itself is what is under test, so the real predicate runs against the real
 * (absent) flag.
 *
 * @module test/services/addon.checkout.recurring-flag-off
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { ProductDomainEnum } from '@repo/schemas';
import type { PurchaseAddonInput } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockAddonCatalogGetBySlug,
    mockPlanServiceGetById,
    mockPlanServiceGetBySlug,
    mockAccommodationFindById,
    mockCreateRecurringAddonCheckout,
    mockResolveCheckoutMpAddonPlanId,
    mockCreateOwnPreapprovalSubscription,
    mockBillingCheckoutCreate,
    mockPollingJobsCreate,
    mockPromoValidate,
    mockPromoGetByCode
} = vi.hoisted(() => ({
    mockAddonCatalogGetBySlug: vi.fn(),
    mockPlanServiceGetById: vi.fn(),
    mockPlanServiceGetBySlug: vi.fn(),
    mockAccommodationFindById: vi.fn(),
    mockCreateRecurringAddonCheckout: vi.fn(),
    mockResolveCheckoutMpAddonPlanId: vi.fn(),
    mockCreateOwnPreapprovalSubscription: vi.fn(),
    mockBillingCheckoutCreate: vi.fn(),
    mockPollingJobsCreate: vi.fn(),
    mockPromoValidate: vi.fn(),
    mockPromoGetByCode: vi.fn()
}));

// No HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED key at all — the production shape.
vi.mock('../../src/utils/env', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA',
        HOSPEDA_BILLING_POLLING_ENABLED: true
    }
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/services/billing/orphan-payment-queue.service', () => ({
    recordOrphanPayment: vi.fn()
}));

// Spread the real module so `shouldUseRecurringAddonCheckout` — the decision
// under test — keeps its real implementation.
vi.mock('../../src/services/addon.checkout.recurring', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../src/services/addon.checkout.recurring')>();
    return { ...actual, createRecurringAddonCheckout: mockCreateRecurringAddonCheckout };
});

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
        getDb: vi.fn(() => ({ insert: vi.fn(() => ({ values: vi.fn() })) }))
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
        hydrateSubscriptionProductDomains: vi.fn(async (subs: readonly Record<string, unknown>[]) =>
            subs.map((sub) => ({
                ...sub,
                productDomain: sub.productDomain === undefined ? 'accommodation' : sub.productDomain
            }))
        )
    };
});

import { createAddonCheckout } from '../../src/services/addon.checkout';

const CUSTOMER_ID = 'cust_flag_off';
const RECURRING_ADDON = {
    id: '00000000-0000-4000-8000-0000000adds1',
    slug: 'extra-photos-20',
    name: 'Extra Photos Pack (+20 photos)',
    description: 'Adds 20 additional photos.',
    billingType: 'recurring' as const,
    priceArs: 500_000,
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

const INPUT: PurchaseAddonInput = {
    customerId: CUSTOMER_ID,
    addonSlug: RECURRING_ADDON.slug,
    userId: 'user_flag_off'
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
                .mockResolvedValue([{ id: 'sub_owner', status: 'active', planId: 'plan_owner' }]),
            cancel: vi.fn()
        },
        plans: { listAll: vi.fn().mockResolvedValue([]) },
        checkout: { create: mockBillingCheckoutCreate },
        getStorage: vi
            .fn()
            .mockReturnValue({ subscriptionPollingJobs: { create: mockPollingJobsCreate } })
    } as unknown as QZPayBilling;
}

describe('createAddonCheckout (HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED unset)', () => {
    let billing: QZPayBilling;

    beforeEach(() => {
        vi.clearAllMocks();
        billing = createBilling();

        mockAddonCatalogGetBySlug.mockResolvedValue({ success: true, data: RECURRING_ADDON });
        mockPlanServiceGetById.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND' } });
        mockPlanServiceGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND' }
        });
        mockAccommodationFindById.mockResolvedValue(null);
        mockPromoValidate.mockResolvedValue({ valid: true, discountAmount: 0 });
        mockPromoGetByCode.mockResolvedValue({ success: true, data: { id: 'promo_uuid' } });
        mockBillingCheckoutCreate.mockResolvedValue({
            id: 'session_flag_off',
            providerInitPoint: 'https://www.mercadopago.com.ar/checkout/one-time',
            expiresAt: new Date('2030-01-01T00:30:00Z')
        });
        mockPollingJobsCreate.mockResolvedValue({ id: 'poll_1', nextPollAt: new Date() });
    });

    it("keeps a RECURRING add-on on the one-time mode:'payment' Preference path", async () => {
        const result = await createAddonCheckout(billing, INPUT);

        expect(result.success).toBe(true);
        expect(result.data?.checkoutUrl).toBe('https://www.mercadopago.com.ar/checkout/one-time');
        expect(mockBillingCheckoutCreate).toHaveBeenCalledTimes(1);
        expect(mockBillingCheckoutCreate.mock.calls[0]?.[0]?.mode).toBe('payment');
        // The proof the flag leaked nowhere: no preapproval, no MP add-on plan,
        // and the recurring module never entered.
        expect(mockCreateRecurringAddonCheckout).not.toHaveBeenCalled();
        expect(mockResolveCheckoutMpAddonPlanId).not.toHaveBeenCalled();
        expect(mockCreateOwnPreapprovalSubscription).not.toHaveBeenCalled();
        // And the Preference's polling fallback — the ONLY confirmation channel
        // for a one-time add-on — is still scheduled.
        expect(mockPollingJobsCreate).toHaveBeenCalledTimes(1);
    });

    it('still accepts a promo code on a recurring add-on', async () => {
        mockPromoValidate.mockResolvedValue({ valid: true, discountAmount: 100_000 });

        const result = await createAddonCheckout(billing, { ...INPUT, promoCode: 'SAVE10' });

        // The flag-ON path refuses this combination; with the flag off nothing
        // about it may change, because the discount is honoured by the one-time
        // charge.
        expect(result.success).toBe(true);
        expect(result.data?.amount).toBe(400_000);
        expect(mockBillingCheckoutCreate.mock.calls[0]?.[0]?.lineItems?.[0]?.unitAmount).toBe(
            400_000
        );
        expect(mockCreateRecurringAddonCheckout).not.toHaveBeenCalled();
    });
});
