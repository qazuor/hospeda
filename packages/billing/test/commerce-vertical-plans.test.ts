/**
 * Per-vertical commerce catalogue tests (HOS-688 §6.8).
 *
 * The commercial substance of §6.8 is a single number — one listing per owner
 * per vertical — and every layer beneath it resolves an unknown limit key to
 * *unlimited* without raising anything. These tests lock the SHAPE of the
 * catalogue (which key each tier declares, which tier is sellable, what is
 * deliberately absent); the end-to-end assertion that the cap is actually
 * enforced lives in `apps/api` (AC-30), because a shape test here would pass
 * just as happily with the middleware unwired.
 *
 * Note the two things asserted by ABSENCE, both deliberate:
 * - a tier declares exactly ONE limit key, not the others at `-1`. Both read
 *   as unlimited downstream, but an absent key reads as "this plan does not
 *   meter that", which is what is true.
 * - the vertical plans are absent from `ALL_PLANS`, which is what keeps the
 *   accommodation seed loop, the public plan list and the grant-matrix
 *   snapshot accommodation-only.
 *
 * @module test/commerce-vertical-plans
 */
import { describe, expect, it } from 'vitest';
import {
    ALL_EXPERIENCE_PLANS,
    ALL_GASTRONOMY_PLANS,
    ALL_PLANS,
    COMMERCE_VERTICAL_MONTHLY_PRICE_ARS,
    DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL,
    EXPERIENCE_BASICO_PLAN,
    EXPERIENCE_PREMIUM_PLAN,
    GASTRONOMY_BASICO_PLAN,
    GASTRONOMY_PREMIUM_PLAN
} from '../src/config/plans.config.js';
import { COMMERCE_TRIAL_DAYS } from '../src/constants/billing.constants.js';
import { LimitKey } from '../src/types/plan.types.js';

describe('per-vertical commerce catalogues (HOS-688)', () => {
    it('ships a three-tier shape for each vertical', () => {
        expect(ALL_GASTRONOMY_PLANS).toHaveLength(3);
        expect(ALL_EXPERIENCE_PLANS).toHaveLength(3);
    });

    it('enables exactly one tier per vertical, and since HOS-818 it is the BASIC one', () => {
        // Owner decision (HOS-818): "premium" is reserved for a future step that
        // actually carries more functionality, so today's buyers land on the entry
        // tier. Asserting the identity (not just the count) is what makes a silent
        // slide back to premium fail here rather than in production.
        expect(ALL_GASTRONOMY_PLANS.filter((p) => p.isActive)).toEqual([GASTRONOMY_BASICO_PLAN]);
        expect(ALL_EXPERIENCE_PLANS.filter((p) => p.isActive)).toEqual([EXPERIENCE_BASICO_PLAN]);
    });

    it('declares exactly one limit key per tier, and it is that vertical own cap', () => {
        for (const plan of ALL_GASTRONOMY_PLANS) {
            expect(plan.limits.map((l) => l.key)).toEqual([LimitKey.MAX_GASTRONOMIES]);
        }
        for (const plan of ALL_EXPERIENCE_PLANS) {
            expect(plan.limits.map((l) => l.key)).toEqual([LimitKey.MAX_EXPERIENCES]);
        }
    });

    it('never declares the other vertical cap, not even as unlimited', () => {
        // The engine cannot tell "-1" apart from "this plan does not meter it",
        // so the two must never be conflated here: a gastronomy plan carrying
        // `max_experiences: -1` would hand its owner unlimited experiences.
        const gastronomyKeys = ALL_GASTRONOMY_PLANS.flatMap((p) => p.limits.map((l) => l.key));
        const experienceKeys = ALL_EXPERIENCE_PLANS.flatMap((p) => p.limits.map((l) => l.key));
        expect(gastronomyKeys).not.toContain(LimitKey.MAX_EXPERIENCES);
        expect(experienceKeys).not.toContain(LimitKey.MAX_GASTRONOMIES);
        expect(gastronomyKeys).not.toContain(LimitKey.MAX_ACCOMMODATIONS);
        expect(experienceKeys).not.toContain(LimitKey.MAX_ACCOMMODATIONS);
    });

    it('caps the sellable tier at one listing', () => {
        expect(GASTRONOMY_BASICO_PLAN.limits[0]?.value).toBe(1);
        expect(EXPERIENCE_BASICO_PLAN.limits[0]?.value).toBe(1);
    });

    it('keeps the sellable tier at the price commerce charges today', () => {
        expect(GASTRONOMY_BASICO_PLAN.monthlyPriceArs).toBe(COMMERCE_VERTICAL_MONTHLY_PRICE_ARS);
        expect(EXPERIENCE_BASICO_PLAN.monthlyPriceArs).toBe(COMMERCE_VERTICAL_MONTHLY_PRICE_ARS);
    });

    it('hands the retired premium tier over unchanged in everything but its flag (HOS-818)', () => {
        // The rename is only safe because the two tiers are indistinguishable to
        // a payer. If they ever diverge, the swap stops being a no-op for the
        // people already paying, and that has to fail loudly here.
        for (const [basico, premium] of [
            [GASTRONOMY_BASICO_PLAN, GASTRONOMY_PREMIUM_PLAN],
            [EXPERIENCE_BASICO_PLAN, EXPERIENCE_PREMIUM_PLAN]
        ] as const) {
            expect(premium.isActive).toBe(false);
            expect(basico.monthlyPriceArs).toBe(premium.monthlyPriceArs);
            expect(basico.limits).toEqual(premium.limits);
            expect(basico.entitlements).toEqual(premium.entitlements);
            expect(basico.hasTrial).toBe(premium.hasTrial);
            expect(basico.trialDays).toBe(premium.trialDays);
        }
    });

    it('grants no entitlement in either vertical', () => {
        // §6.8: neither vertical grants an entitlement, which is why the create
        // route runs the limit check with no entitlement gate ahead of it.
        for (const plan of [...ALL_GASTRONOMY_PLANS, ...ALL_EXPERIENCE_PLANS]) {
            expect(plan.entitlements).toEqual([]);
        }
    });

    it('gives each vertical its own plan slug, never a shared one', () => {
        // MercadoPago scopes a free trial to (payer, preapproval_plan): sharing
        // one plan across both verticals would silently charge the second one
        // from day one while the page promised a trial (HOS-522).
        expect(GASTRONOMY_BASICO_PLAN.slug).not.toBe(EXPERIENCE_BASICO_PLAN.slug);
        expect(DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL).toEqual({
            gastronomy: GASTRONOMY_BASICO_PLAN.slug,
            experience: EXPERIENCE_BASICO_PLAN.slug
        });
    });

    it('is EXCLUDED from ALL_PLANS (isolated via product_domain, not the plan list)', () => {
        const slugs = ALL_PLANS.map((p) => p.slug);
        for (const plan of [...ALL_GASTRONOMY_PLANS, ...ALL_EXPERIENCE_PLANS]) {
            expect(slugs).not.toContain(plan.slug);
        }
    });

    it('grants the sellable tier the same 30-day trial every accommodation plan gets (HOS-590)', () => {
        expect(GASTRONOMY_BASICO_PLAN.hasTrial).toBe(true);
        expect(GASTRONOMY_BASICO_PLAN.trialDays).toBe(COMMERCE_TRIAL_DAYS);
        expect(EXPERIENCE_BASICO_PLAN.hasTrial).toBe(true);
        expect(EXPERIENCE_BASICO_PLAN.trialDays).toBe(COMMERCE_TRIAL_DAYS);
        expect(COMMERCE_TRIAL_DAYS).toBe(30);
    });

    it('leaves the NEVER-SOLD disabled tiers without a trial or a price (nothing to precede)', () => {
        // The retired premium tier is deliberately excluded: it keeps its price
        // and trial because its row, its price row and its MercadoPago
        // preapproval_plan all still exist in every seeded environment, and live
        // subscriptions hang off them (HOS-818). Zeroing the baseline would
        // describe a state no real database is in — and would make rolling the
        // rename back a second migration instead of an env-var edit.
        const retired = new Set([GASTRONOMY_PREMIUM_PLAN.slug, EXPERIENCE_PREMIUM_PLAN.slug]);
        const neverSold = [...ALL_GASTRONOMY_PLANS, ...ALL_EXPERIENCE_PLANS].filter(
            (plan) => !plan.isActive && !retired.has(plan.slug)
        );

        // Guards the filter itself: an empty list would make every assertion
        // below vacuously true, which is exactly how this test would rot into
        // green after a future retier.
        expect(neverSold.length).toBe(2);
        for (const plan of neverSold) {
            expect(plan.hasTrial).toBe(false);
            expect(plan.trialDays).toBe(0);
            expect(plan.monthlyPriceArs).toBe(0);
        }
    });
});
