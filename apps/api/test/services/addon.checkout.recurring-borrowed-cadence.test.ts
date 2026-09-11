/**
 * HOS-847 regression — the borrowed price's CADENCE is load-bearing, so
 * `resolveSubscriptionPlanReference` must refuse anything but a plain monthly
 * row rather than falling back.
 *
 * ## Why this became a hazard only now
 *
 * The recurring add-on borrows the customer's plan price purely to satisfy
 * qzpay's `mode: 'paid'` plan+price requirement. While the add-on's own
 * MercadoPago plan was being sent as `providerPriceId`, the adapter returned
 * early and never read that borrowed row at all — so which price got picked was
 * genuinely inert, and the resolver could reasonably fall back to
 * `find((p) => p.active)` and then `prices[0]`, mirroring qzpay's own fallback.
 *
 * The HOS-1221 port removed the plan id (MercadoPago rejects that request with
 * HTTP 400 `"Create subscription - card_token_id is required"`). The adapter now
 * takes its other branch and builds the inline `auto_recurring` out of the
 * borrowed row, deriving `frequency` / `frequency_type` from
 * `price.billingInterval` × `price.intervalCount` — VERBATIM, with no override
 * available. The amount has an override (`providerUnitAmountOverride`); the
 * cadence does not.
 *
 * So a fallback landing on an ANNUAL row — every owner plan has one, and
 * `prices[0]` has no defined order — would mint a preapproval charging the
 * add-on's MONTHLY amount once every twelve months. That is the same silent
 * mispricing the amount override exists to prevent, in the other dimension, and
 * nothing would surface it until a real charge failed to arrive a month later.
 *
 * Refusing is the safe direction: the caller turns `null` into a typed
 * `RECURRING_ADDON_PLAN_UNRESOLVED` refusal, and every seeded plan carries the
 * plain monthly row this looks for.
 *
 * @module test/services/addon.checkout.recurring-borrowed-cadence
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

// Partial mock: `addon.checkout.recurring-resolve` also imports `PlanService`'s
// siblings from this package, and a whole-module `vi.mock` would leave every
// other export `undefined` — a failure that hides inside the module's own
// try/catch rather than announcing itself.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        PlanService: vi.fn().mockImplementation(function () {
            return { getById: mockGetById, getBySlug: mockGetBySlug };
        })
    };
});

const PLAN_ID = '00000000-0000-4000-8000-00000000cade';

const MONTHLY_PRICE = {
    id: 'price_owner_monthly',
    planId: PLAN_ID,
    unitAmount: 1_800_000,
    currency: 'ARS',
    billingInterval: 'month',
    intervalCount: 1,
    active: true
};

const ANNUAL_PRICE = {
    id: 'price_owner_annual',
    planId: PLAN_ID,
    unitAmount: 18_000_000,
    currency: 'ARS',
    billingInterval: 'year',
    intervalCount: 1,
    active: true
};

/** A quarterly variant — `'month'` interval, but NOT `intervalCount === 1`. */
const QUARTERLY_PRICE = {
    id: 'price_owner_quarterly',
    planId: PLAN_ID,
    unitAmount: 5_400_000,
    currency: 'ARS',
    billingInterval: 'month',
    intervalCount: 3,
    active: true
};

function billingWithPrices(prices: unknown[]): QZPayBilling {
    mockGetPrices.mockResolvedValue(prices);
    return { plans: { getPrices: mockGetPrices } } as unknown as QZPayBilling;
}

describe('HOS-847 — the borrowed price must be a plain monthly row or nothing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetById.mockResolvedValue({ success: true, data: { id: PLAN_ID } });
        mockGetBySlug.mockResolvedValue({ success: false });
    });

    it('picks the plain monthly price when the plan has one', async () => {
        // Arrange — the monthly row is deliberately NOT first, so a green here
        // cannot be `prices[0]` agreeing by accident.
        const { resolveSubscriptionPlanReference } = await import(
            '../../src/services/addon.checkout.recurring-resolve'
        );
        const billing = billingWithPrices([ANNUAL_PRICE, QUARTERLY_PRICE, MONTHLY_PRICE]);

        // Act
        const result = await resolveSubscriptionPlanReference({
            billing,
            planIdOrSlug: PLAN_ID
        });

        // Assert
        expect(result).not.toBeNull();
        expect(result?.priceId).toBe(MONTHLY_PRICE.id);
        expect(result?.planId).toBe(PLAN_ID);
    });

    it('REFUSES an annual-only plan instead of borrowing a yearly cadence', async () => {
        // The core of this file. The old fallback chain would have returned the
        // annual row here, and the preapproval would then have charged the
        // add-on's ARS 5.000 once every TWELVE months.
        const { resolveSubscriptionPlanReference } = await import(
            '../../src/services/addon.checkout.recurring-resolve'
        );
        const billing = billingWithPrices([ANNUAL_PRICE]);

        const result = await resolveSubscriptionPlanReference({
            billing,
            planIdOrSlug: PLAN_ID
        });

        expect(result).toBeNull();
    });

    it('REFUSES a multi-month variant — intervalCount must be 1', async () => {
        const { resolveSubscriptionPlanReference } = await import(
            '../../src/services/addon.checkout.recurring-resolve'
        );
        const billing = billingWithPrices([QUARTERLY_PRICE]);

        const result = await resolveSubscriptionPlanReference({
            billing,
            planIdOrSlug: PLAN_ID
        });

        expect(result).toBeNull();
    });

    it('REFUSES an INACTIVE monthly price rather than reviving it', async () => {
        const { resolveSubscriptionPlanReference } = await import(
            '../../src/services/addon.checkout.recurring-resolve'
        );
        const billing = billingWithPrices([{ ...MONTHLY_PRICE, active: false }]);

        const result = await resolveSubscriptionPlanReference({
            billing,
            planIdOrSlug: PLAN_ID
        });

        expect(result).toBeNull();
    });

    it('REFUSES a plan with no prices at all', async () => {
        const { resolveSubscriptionPlanReference } = await import(
            '../../src/services/addon.checkout.recurring-resolve'
        );
        const billing = billingWithPrices([]);

        const result = await resolveSubscriptionPlanReference({
            billing,
            planIdOrSlug: PLAN_ID
        });

        expect(result).toBeNull();
    });
});
