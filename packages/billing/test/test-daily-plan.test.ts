/**
 * Test-daily plan definition tests (billing-interval-override tooling).
 *
 * Asserts the hidden daily test plan is defined with the locked shape and is
 * deliberately EXCLUDED from `ALL_PLANS` (so the accommodation plan list, the
 * grant-matrix snapshot, and config-drift checks stay unaffected — subscribe
 * access is gated separately by `HOSPEDA_SHOW_TEST_BILLING_PLAN` in the API,
 * not by this config).
 */
import { describe, expect, it } from 'vitest';
import {
    ALL_PLANS,
    OWNER_PREMIUM_PLAN,
    TEST_DAILY_PLAN,
    TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS
} from '../src/config/plans.config.js';

describe('TEST_DAILY_PLAN (billing-interval-override)', () => {
    it('is defined with a recognizable test-daily slug', () => {
        expect(TEST_DAILY_PLAN.slug).toBe('owner-test-daily');
    });

    it('has a 1-day no-card trial (HOS-110: exercises trial->expiry on a fast cadence)', () => {
        expect(TEST_DAILY_PLAN.hasTrial).toBe(true);
        expect(TEST_DAILY_PLAN.trialDays).toBe(1);
    });

    it('copies entitlements and limits verbatim from OWNER_PREMIUM_PLAN', () => {
        expect(TEST_DAILY_PLAN.entitlements).toEqual(OWNER_PREMIUM_PLAN.entitlements);
        expect(TEST_DAILY_PLAN.limits).toEqual(OWNER_PREMIUM_PLAN.limits);
    });

    it('carries the documented minimum-ARS placeholder price and no annual price', () => {
        expect(TEST_DAILY_PLAN.monthlyPriceArs).toBe(TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS);
        expect(TEST_DAILY_PLAN.annualPriceArs).toBeNull();
    });

    it("is priced at exactly MercadoPago's $15.00 ARS preapproval minimum (1500 centavos)", () => {
        // Pinned to the real MP-confirmed floor, not an assumed "small" value.
        // A production checkout against this plan failed with
        // "Cannot pay an amount lower than $ 15.00" when this constant was
        // 100 (ARS $1.00) — regression guard against ever lowering it again
        // without re-confirming MP's minimum has changed.
        expect(TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS).toBe(1500);
    });

    it('is INACTIVE so the active-filtered public plans endpoint never lists it', () => {
        // active:false keeps it off `/api/v1/public/plans` (which filters
        // active:true) with no endpoint change. It stays subscribable because
        // `resolvePlanBySlug` calls `billing.plans.list()` with no active filter,
        // gated solely by HOSPEDA_SHOW_TEST_BILLING_PLAN.
        expect(TEST_DAILY_PLAN.isActive).toBe(false);
    });

    it('is EXCLUDED from ALL_PLANS (isolated via the env flag gate, not the plan list)', () => {
        const slugs = ALL_PLANS.map((p) => p.slug);
        expect(slugs).not.toContain(TEST_DAILY_PLAN.slug);
        // Sanity: ALL_PLANS still has exactly the 9 accommodation-tier plans.
        expect(ALL_PLANS).toHaveLength(9);
    });
});
