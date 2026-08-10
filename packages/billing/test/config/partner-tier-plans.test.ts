/**
 * @fileoverview
 * Tests for the partner tier plan catalog (HOS-278 D4).
 *
 * Two things worth pinning:
 * - the annual price is DERIVED from the monthly one by the same "2 months
 *   free" rule every other plan in the file follows, so a hand-edit that
 *   breaks the ratio shows up here instead of in someone's invoice;
 * - every tier the enum declares has an entry here, so a tier added without a
 *   plan resolves by decision rather than by accident.
 *
 * The second point used to be about BRONZE mapping to no plan. HOS-294 removed
 * that tier, so no tier maps to null any more — see the config's own header for
 * what that means for `isPartnerTierSellable`.
 */

import { PartnerTierEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    isPartnerTierSellable,
    PARTNER_TIER_PLAN_SLUG,
    resolvePartnerTierPlanSlug
} from '../../src/config/partner-tier-plans.config.js';
import {
    ALL_PARTNER_PLANS,
    ALL_PLANS,
    PARTNER_GOLD_PLAN,
    PARTNER_SILVER_PLAN
} from '../../src/config/plans.config.js';

/**
 * The house rule: a year costs ten months. Expressed as a constant so the
 * assertions below read as "follows the rule" rather than as magic arithmetic.
 */
const MONTHS_CHARGED_PER_YEAR = 10;

describe('partner tier prices', () => {
    it('charges the owner-confirmed monthly amounts', () => {
        // Arrange + Act + Assert — centavos. Owner, 2026-08-06.
        expect(PARTNER_SILVER_PLAN.monthlyPriceArs).toBe(1_500_000);
        expect(PARTNER_GOLD_PLAN.monthlyPriceArs).toBe(3_000_000);
    });

    it.each([
        PARTNER_SILVER_PLAN,
        PARTNER_GOLD_PLAN
    ])('derives $slug annual price as ten months, like every other plan', (plan) => {
        // Arrange — the annual figure was never decided separately; it is
        // the monthly one under the file-wide "2 months free" rule. A
        // hand-edit that breaks the ratio is a silent mispricing.
        expect(plan.annualPriceArs).toBe(plan.monthlyPriceArs * MONTHS_CHARGED_PER_YEAR);
    });

    it('prices gold at exactly twice silver, at both cadences', () => {
        // Arrange — not a rule of the system, but it IS what the owner chose,
        // and a typo in one figure would break the relationship silently.
        expect(PARTNER_GOLD_PLAN.monthlyPriceArs).toBe(PARTNER_SILVER_PLAN.monthlyPriceArs * 2);
        expect(PARTNER_GOLD_PLAN.annualPriceArs).toBe(
            (PARTNER_SILVER_PLAN.annualPriceArs ?? 0) * 2
        );
    });
});

describe('partner plans stay out of the accommodation catalog', () => {
    it.each(ALL_PARTNER_PLANS)('excludes $slug from ALL_PLANS', (plan) => {
        // Arrange — `GET /public/plans` builds from ALL_PLANS. A partner plan
        // leaking in would offer accommodation hosts a tier they cannot use.
        expect(ALL_PLANS.map((p) => p.slug)).not.toContain(plan.slug);
    });

    it('keeps the legacy flat plan in the seeded set', () => {
        // Arrange — `partner-listing` predates the tiers and a live partner may
        // still point `plan_id` at it. Dropping it from the seeded list would
        // strand that partner's plan lookup with nothing saying so.
        expect(ALL_PARTNER_PLANS.map((p) => p.slug)).toContain('partner-listing');
    });
});

describe('PARTNER_TIER_PLAN_SLUG', () => {
    it('maps the two commercial tiers to their plans', () => {
        expect(resolvePartnerTierPlanSlug({ tier: PartnerTierEnum.SILVER })).toBe('partner-silver');
        expect(resolvePartnerTierPlanSlug({ tier: PartnerTierEnum.GOLD })).toBe('partner-gold');
    });

    it('leaves no tier without a plan, now that BRONZE is gone', () => {
        // Arrange — BRONZE was the only tier that mapped to null, and HOS-294
        // removed it from the enum. This asserts the CURRENT truth plainly
        // rather than leaving a stale test that pretended to cover a
        // non-sellable tier: today every tier is sellable, so
        // `isPartnerTierSellable` cannot return false. If a non-sellable tier is
        // ever reintroduced, this test is what should fail and force the
        // decision back into the open.
        for (const tier of Object.values(PartnerTierEnum)) {
            expect(resolvePartnerTierPlanSlug({ tier })).not.toBeNull();
            expect(isPartnerTierSellable({ tier })).toBe(true);
        }
    });

    it('names every tier the enum declares, so a new one cannot be forgotten', () => {
        // Arrange — a tier added to the enum without an entry here would
        // resolve to `undefined` and read as "not sellable" by accident rather
        // than by decision. This forces the decision to be made.
        const declared = Object.values(PartnerTierEnum);

        // Act + Assert
        expect(Object.keys(PARTNER_TIER_PLAN_SLUG).sort()).toEqual([...declared].sort());
    });

    it('points every non-null mapping at a plan that actually exists', () => {
        // Arrange — a typo'd slug would resolve to a plan the seed never
        // creates, and the failure would surface as a checkout that cannot
        // find its price.
        const seededSlugs = ALL_PARTNER_PLANS.map((p) => p.slug);

        // Act + Assert
        for (const slug of Object.values(PARTNER_TIER_PLAN_SLUG)) {
            if (slug !== null) {
                expect(seededSlugs).toContain(slug);
            }
        }
    });
});
