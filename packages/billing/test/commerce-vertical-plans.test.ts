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
import { ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL } from '../src/config/commerce-entitlements.config.js';
import {
    ALL_EXPERIENCE_PLANS,
    ALL_GASTRONOMY_PLANS,
    ALL_PLANS,
    COMMERCE_VERTICAL_MONTHLY_PRICE_ARS,
    DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL,
    EXPERIENCE_BASICO_PLAN,
    EXPERIENCE_PREMIUM_PLAN,
    EXPERIENCE_PRO_PLAN,
    GASTRONOMY_BASICO_PLAN,
    GASTRONOMY_PREMIUM_PLAN,
    GASTRONOMY_PRO_PLAN
} from '../src/config/plans.config.js';
import { COMMERCE_TRIAL_DAYS } from '../src/constants/billing.constants.js';
import { EntitlementKey } from '../src/types/entitlement.types.js';
import { LimitKey } from '../src/types/plan.types.js';

describe('per-vertical commerce catalogues (HOS-688)', () => {
    it('ships a three-tier shape for each vertical', () => {
        expect(ALL_GASTRONOMY_PLANS).toHaveLength(3);
        expect(ALL_EXPERIENCE_PLANS).toHaveLength(3);
    });

    it('keeps básico the DEFAULT sellable tier per vertical, since HOS-818', () => {
        // Owner decision (HOS-818): "premium" is reserved for a future step that
        // actually carries more functionality, so today's buyers land on the entry
        // tier by DEFAULT. Asserting the identity (not just membership) is what
        // makes a silent slide back to premium fail here rather than in
        // production. `resolveCommercePlanSlug` / `DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL`
        // is the ONE place that decides which `isActive` tier a real checkout
        // actually resolves to — see that constant's own test below.
        expect(DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy).toBe(GASTRONOMY_BASICO_PLAN.slug);
        expect(DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.experience).toBe(EXPERIENCE_BASICO_PLAN.slug);
    });

    it('activated gastronomy-pro (HOS-895 PR2) without touching experience', () => {
        // Owner decision (2026-09-03): gastronomy now has TWO `isActive` tiers —
        // básico stays the checkout DEFAULT (see the test above), and `-pro` is a
        // second valid subscription target that grants `manage_gastronomy_menu`
        // (the structured carta). Experience is asserted unchanged by the SAME
        // activation, since a commerce-vertical edit touching the sibling
        // vertical is exactly the class of drift HOS-1074 warns about.
        expect(ALL_GASTRONOMY_PLANS.filter((p) => p.isActive)).toEqual([
            GASTRONOMY_BASICO_PLAN,
            GASTRONOMY_PRO_PLAN
        ]);
        expect(ALL_EXPERIENCE_PLANS.filter((p) => p.isActive)).toEqual([EXPERIENCE_BASICO_PLAN]);
        expect(GASTRONOMY_PRO_PLAN.monthlyPriceArs).toBe(4_500_000);
        expect(GASTRONOMY_PRO_PLAN.hasTrial).toBe(true);
        expect(GASTRONOMY_PRO_PLAN.trialDays).toBe(COMMERCE_TRIAL_DAYS);
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

    it('hands the retired premium tier over losing nothing (HOS-818, amended by HOS-1058)', () => {
        // HOS-818's swap of the sellable role from premium to básico is only
        // safe if nobody already paying LOSES anything by it. That was
        // originally asserted as "the two tiers are identical", and HOS-1058
        // is the change that makes them differ for the first time: premium now
        // grants the printable ficha and básico does not.
        //
        // So the invariant is restated as the direction that actually protects
        // a payer — premium ⊇ básico — and everything commercial (price, cap,
        // trial) stays byte-identical.
        for (const [basico, premium] of [
            [GASTRONOMY_BASICO_PLAN, GASTRONOMY_PREMIUM_PLAN],
            [EXPERIENCE_BASICO_PLAN, EXPERIENCE_PREMIUM_PLAN]
        ] as const) {
            expect(premium.isActive).toBe(false);
            expect(basico.monthlyPriceArs).toBe(premium.monthlyPriceArs);
            expect(basico.limits).toEqual(premium.limits);
            expect(basico.hasTrial).toBe(premium.hasTrial);
            expect(basico.trialDays).toBe(premium.trialDays);
            for (const key of basico.entitlements) {
                expect(premium.entitlements).toContain(key);
            }
        }
    });

    it('grants its own vertical pair on ALL THREE tiers (HOS-1074)', () => {
        // Reversal of §6.8's `entitlements: []` (owner decision, 2026-09-01):
        // commerce now runs on the same entitlement mechanism accommodation
        // does, so the create route carries a real `requireEntitlement` ahead
        // of its limit check.
        //
        // Asserted per TIER rather than per catalogue, because the uniformity
        // is the load-bearing part: a tier that granted a narrower set would
        // take editing away from the owners on it, and the gate would read as
        // a billing bug rather than as a catalogue one.
        for (const plan of ALL_GASTRONOMY_PLANS) {
            for (const key of ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL.gastronomy) {
                expect(plan.entitlements).toContain(key);
            }
        }
        for (const plan of ALL_EXPERIENCE_PLANS) {
            for (const key of ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL.experience) {
                expect(plan.entitlements).toContain(key);
            }
        }
    });

    it('grants the printable ficha on the PREMIUM tier of each vertical only (HOS-1058)', () => {
        // The first commerce capability that is a tier differentiator rather
        // than a vertical-wide one. Both halves are load-bearing and neither is
        // sufficient alone: the positive half fails if the grant is dropped,
        // the negative half fails if it is added to the vertical-wide map —
        // which would hand a premium feature to every entry-plan owner while
        // still looking, from the gate's side, exactly like it works.
        expect(GASTRONOMY_PREMIUM_PLAN.entitlements).toContain(EntitlementKey.DOWNLOAD_LISTING_PDF);
        expect(EXPERIENCE_PREMIUM_PLAN.entitlements).toContain(EntitlementKey.DOWNLOAD_LISTING_PDF);

        for (const plan of [
            GASTRONOMY_BASICO_PLAN,
            GASTRONOMY_PRO_PLAN,
            EXPERIENCE_BASICO_PLAN,
            EXPERIENCE_PRO_PLAN
        ]) {
            expect(plan.entitlements).not.toContain(EntitlementKey.DOWNLOAD_LISTING_PDF);
        }
    });

    it('grants the photo per dish on gastronomy PREMIUM alone (HOS-1045)', () => {
        // Narrower than the printable ficha above in BOTH directions, and the
        // test says so rather than leaving it to be inferred:
        //
        //  - one vertical, not both. An experience has no carta, so there is
        //    no dish for a photo to hang on; granting it to
        //    `experience-premium` would advertise a capability whose routes
        //    that owner can never reach.
        //  - one TIER, and specifically not `-pro`. `-pro` grants
        //    MANAGE_GASTRONOMY_MENU (asserted below, so the two cannot be
        //    conflated): it may type a carta and may not put pictures on it.
        //    That gap IS the premium step, so an assertion that only checked
        //    "premium has it" would still pass on the day someone widened the
        //    grant to `-pro` and quietly deleted the reason to upgrade.
        expect(GASTRONOMY_PREMIUM_PLAN.entitlements).toContain(EntitlementKey.MENU_ITEM_PHOTOS);
        expect(GASTRONOMY_PRO_PLAN.entitlements).toContain(EntitlementKey.MANAGE_GASTRONOMY_MENU);

        for (const plan of [
            GASTRONOMY_BASICO_PLAN,
            GASTRONOMY_PRO_PLAN,
            EXPERIENCE_BASICO_PLAN,
            EXPERIENCE_PRO_PLAN,
            EXPERIENCE_PREMIUM_PLAN
        ]) {
            expect(plan.entitlements).not.toContain(EntitlementKey.MENU_ITEM_PHOTOS);
        }
    });

    it('never grants the OTHER vertical, nor an accommodation key (HOS-1074)', () => {
        // The whole reason four new keys exist instead of reusing
        // `EDIT_ACCOMMODATION_INFO` / `PUBLISH_ACCOMMODATIONS`: the loader
        // resolves ONE domain, so a shared key answers for the wrong
        // subscription in both directions. A gastronomy plan leaking an
        // experience key would rebuild that confusion inside commerce itself.
        for (const plan of ALL_GASTRONOMY_PLANS) {
            expect(plan.entitlements).not.toContain(EntitlementKey.EDIT_EXPERIENCE_INFO);
            expect(plan.entitlements).not.toContain(EntitlementKey.PUBLISH_EXPERIENCE);
            expect(plan.entitlements).not.toContain(EntitlementKey.EDIT_ACCOMMODATION_INFO);
            expect(plan.entitlements).not.toContain(EntitlementKey.PUBLISH_ACCOMMODATIONS);
        }
        for (const plan of ALL_EXPERIENCE_PLANS) {
            expect(plan.entitlements).not.toContain(EntitlementKey.EDIT_GASTRONOMY_INFO);
            expect(plan.entitlements).not.toContain(EntitlementKey.PUBLISH_GASTRONOMY);
            expect(plan.entitlements).not.toContain(EntitlementKey.EDIT_ACCOMMODATION_INFO);
            expect(plan.entitlements).not.toContain(EntitlementKey.PUBLISH_ACCOMMODATIONS);
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
        //
        // HOS-895 PR2 activated `gastronomy-pro`, so it moved OUT of this set —
        // experience-pro is now the only tier left that has never been sold.
        const retired = new Set([GASTRONOMY_PREMIUM_PLAN.slug, EXPERIENCE_PREMIUM_PLAN.slug]);
        const neverSold = [...ALL_GASTRONOMY_PLANS, ...ALL_EXPERIENCE_PLANS].filter(
            (plan) => !plan.isActive && !retired.has(plan.slug)
        );

        // Guards the filter itself: an empty list would make every assertion
        // below vacuously true, which is exactly how this test would rot into
        // green after a future retier.
        expect(neverSold.map((p) => p.slug)).toEqual([EXPERIENCE_PRO_PLAN.slug]);
        for (const plan of neverSold) {
            expect(plan.hasTrial).toBe(false);
            expect(plan.trialDays).toBe(0);
            expect(plan.monthlyPriceArs).toBe(0);
        }
    });
});
