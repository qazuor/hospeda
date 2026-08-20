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
    EXPERIENCE_PREMIUM_PLAN,
    GASTRONOMY_PREMIUM_PLAN
} from '../src/config/plans.config.js';
import { LimitKey } from '../src/types/plan.types.js';

describe('per-vertical commerce catalogues (HOS-688)', () => {
    it('ships a three-tier shape for each vertical', () => {
        expect(ALL_GASTRONOMY_PLANS).toHaveLength(3);
        expect(ALL_EXPERIENCE_PLANS).toHaveLength(3);
    });

    it('enables exactly one tier per vertical', () => {
        expect(ALL_GASTRONOMY_PLANS.filter((p) => p.isActive)).toEqual([GASTRONOMY_PREMIUM_PLAN]);
        expect(ALL_EXPERIENCE_PLANS.filter((p) => p.isActive)).toEqual([EXPERIENCE_PREMIUM_PLAN]);
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
        expect(GASTRONOMY_PREMIUM_PLAN.limits[0]?.value).toBe(1);
        expect(EXPERIENCE_PREMIUM_PLAN.limits[0]?.value).toBe(1);
    });

    it('keeps the sellable tier at the price commerce charges today', () => {
        expect(GASTRONOMY_PREMIUM_PLAN.monthlyPriceArs).toBe(COMMERCE_VERTICAL_MONTHLY_PRICE_ARS);
        expect(EXPERIENCE_PREMIUM_PLAN.monthlyPriceArs).toBe(COMMERCE_VERTICAL_MONTHLY_PRICE_ARS);
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
        expect(GASTRONOMY_PREMIUM_PLAN.slug).not.toBe(EXPERIENCE_PREMIUM_PLAN.slug);
        expect(DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL).toEqual({
            gastronomy: GASTRONOMY_PREMIUM_PLAN.slug,
            experience: EXPERIENCE_PREMIUM_PLAN.slug
        });
    });

    it('is EXCLUDED from ALL_PLANS (isolated via product_domain, not the plan list)', () => {
        const slugs = ALL_PLANS.map((p) => p.slug);
        for (const plan of [...ALL_GASTRONOMY_PLANS, ...ALL_EXPERIENCE_PLANS]) {
            expect(slugs).not.toContain(plan.slug);
        }
    });
});
