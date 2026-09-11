/**
 * HOS-847 regression — the borrowed price's CURRENCY is load-bearing for the
 * same reason its cadence is, so `resolveSubscriptionPlanReference` must
 * require ARS rather than take whatever the row carries.
 *
 * The sibling file `addon.checkout.recurring-borrowed-cadence.test.ts` pins the
 * cadence half. This is the other field of the same borrowed object, and it was
 * left unhardened: the `find` filtered `active` + `'month'` + `intervalCount 1`
 * and said nothing about `currency`.
 *
 * Since the HOS-1221 port the MercadoPago adapter builds the preapproval's
 * inline `auto_recurring` from the borrowed row and emits
 * `currency_id: providerInput.price.currency` VERBATIM. There is no currency
 * override — the amount has one (`providerUnitAmountOverride = addon.priceArs`)
 * and the currency does not. So a plan price row denominated in anything but
 * ARS would pair OUR ARS-centavos amount with the provider's own idea of the
 * unit: `transaction_amount: 5000, currency_id: 'USD'` is five thousand
 * dollars a month for an add-on listed at ARS 5.000.
 *
 * Refusing is the same safe direction the cadence takes: `null` becomes a typed
 * `RECURRING_ADDON_PLAN_UNRESOLVED` refusal (422) in the caller, and every
 * seeded plan price is ARS, so nothing real is refused today.
 *
 * @module test/services/addon.checkout.recurring-borrowed-currency
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetById, mockGetBySlug, mockGetPrices } = vi.hoisted(() => ({
    mockGetById: vi.fn(),
    mockGetBySlug: vi.fn(),
    mockGetPrices: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// Partial mock, for the reason spelled out in the cadence sibling: the module
// under test imports other `@repo/service-core` symbols, and a whole-module
// `vi.mock` would leave them `undefined` — a failure that hides inside this
// module's own try/catch instead of announcing itself.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        PlanService: vi.fn().mockImplementation(function () {
            return { getById: mockGetById, getBySlug: mockGetBySlug };
        })
    };
});

const PLAN_ID = '00000000-0000-4000-8000-0000000000cc';

const ARS_MONTHLY_PRICE = {
    id: 'price_owner_monthly_ars',
    planId: PLAN_ID,
    unitAmount: 1_800_000,
    currency: 'ARS',
    billingInterval: 'month',
    intervalCount: 1,
    active: true
};

/** Identical in every dimension the old `find` looked at — only the currency differs. */
const USD_MONTHLY_PRICE = {
    id: 'price_owner_monthly_usd',
    planId: PLAN_ID,
    unitAmount: 1_800_000,
    currency: 'USD',
    billingInterval: 'month',
    intervalCount: 1,
    active: true
};

function billingWithPrices(prices: unknown[]): QZPayBilling {
    mockGetPrices.mockResolvedValue(prices);
    return { plans: { getPrices: mockGetPrices } } as unknown as QZPayBilling;
}

describe('HOS-847 — the borrowed price must be denominated in ARS or nothing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetById.mockResolvedValue({ success: true, data: { id: PLAN_ID } });
        mockGetBySlug.mockResolvedValue({ success: false });
    });

    it('REFUSES a non-ARS monthly price instead of borrowing its currency', async () => {
        // The core of this file. Every other filter passes on this row, so the
        // old `find` returned it and the preapproval would have been created as
        // `transaction_amount: <addon.priceArs>, currency_id: 'USD'`.
        const { resolveSubscriptionPlanReference } = await import(
            '../../src/services/addon.checkout.recurring-resolve'
        );
        const billing = billingWithPrices([USD_MONTHLY_PRICE]);

        const result = await resolveSubscriptionPlanReference({
            billing,
            planIdOrSlug: PLAN_ID
        });

        expect(result).toBeNull();
    });

    it('picks the ARS row when both currencies are on the same plan', async () => {
        // The non-ARS row is deliberately FIRST, so a green here cannot be the
        // array order agreeing by accident.
        const { resolveSubscriptionPlanReference } = await import(
            '../../src/services/addon.checkout.recurring-resolve'
        );
        const billing = billingWithPrices([USD_MONTHLY_PRICE, ARS_MONTHLY_PRICE]);

        const result = await resolveSubscriptionPlanReference({
            billing,
            planIdOrSlug: PLAN_ID
        });

        expect(result).not.toBeNull();
        expect(result?.priceId).toBe(ARS_MONTHLY_PRICE.id);
        expect(result?.planId).toBe(PLAN_ID);
    });

    it('REFUSES a differently-spelled ARS — the string reaches MercadoPago verbatim', async () => {
        // `currency_id` is emitted as-is, so `'ars'` is not a smaller version of
        // `'ARS'`; it is a value the provider was never sent before. Fail closed
        // rather than normalize on the row's behalf.
        const { resolveSubscriptionPlanReference } = await import(
            '../../src/services/addon.checkout.recurring-resolve'
        );
        const billing = billingWithPrices([{ ...ARS_MONTHLY_PRICE, currency: 'ars' }]);

        const result = await resolveSubscriptionPlanReference({
            billing,
            planIdOrSlug: PLAN_ID
        });

        expect(result).toBeNull();
    });

    it('still accepts the plain ARS monthly row — the hardening refuses nothing real', async () => {
        const { resolveSubscriptionPlanReference } = await import(
            '../../src/services/addon.checkout.recurring-resolve'
        );
        const billing = billingWithPrices([ARS_MONTHLY_PRICE]);

        const result = await resolveSubscriptionPlanReference({
            billing,
            planIdOrSlug: PLAN_ID
        });

        expect(result).toEqual({ planId: PLAN_ID, priceId: ARS_MONTHLY_PRICE.id });
    });
});
