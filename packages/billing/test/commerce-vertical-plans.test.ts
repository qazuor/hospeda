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
 * - a tier declares exactly its OWN listing cap and its OWN vertical's AI-chat
 *   cap (HOS-400) — never the other vertical's, and never `-1` for either.
 *   Both read as unlimited downstream, but an absent key reads as "this plan
 *   does not meter that", which is what is true.
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

    it('has ALL SIX tiers on sale since HOS-975', () => {
        // Owner decision (2026-09-03): the whole ladder is sellable. HOS-818 had
        // left one tier active per vertical and HOS-895 PR2 added a second on the
        // gastronomy side; HOS-975 priced the six together and activated the
        // three that were still dark (`gastronomy-premium`, `experience-pro`,
        // `experience-premium`).
        //
        // Asserted as the full ORDERED identity rather than a count, so a tier
        // silently dropping out fails here and not in production, and so a
        // seventh tier added later has to be considered rather than absorbed.
        expect(ALL_GASTRONOMY_PLANS.filter((p) => p.isActive)).toEqual([
            GASTRONOMY_BASICO_PLAN,
            GASTRONOMY_PRO_PLAN,
            GASTRONOMY_PREMIUM_PLAN
        ]);
        expect(ALL_EXPERIENCE_PLANS.filter((p) => p.isActive)).toEqual([
            EXPERIENCE_BASICO_PLAN,
            EXPERIENCE_PRO_PLAN,
            EXPERIENCE_PREMIUM_PLAN
        ]);
    });

    it('declares exactly two limit keys per tier: the listing cap and the vertical AI-chat cap (HOS-400)', () => {
        // HOS-400 added a second limit to every tier of both catalogues: the
        // vertical's own AI-chat quota, declared even by tiers that grant zero
        // of it (see `commerceVerticalTier`'s doc — an omitted key would read
        // as UNLIMITED downstream, not zero). "Exactly one" was true until then;
        // it is "exactly two, in this order" now.
        for (const plan of ALL_GASTRONOMY_PLANS) {
            expect(plan.limits.map((l) => l.key)).toEqual([
                LimitKey.MAX_GASTRONOMIES,
                LimitKey.MAX_AI_CHAT_GASTRONOMY_PER_MONTH
            ]);
        }
        for (const plan of ALL_EXPERIENCE_PLANS) {
            expect(plan.limits.map((l) => l.key)).toEqual([
                LimitKey.MAX_EXPERIENCES,
                LimitKey.MAX_AI_CHAT_EXPERIENCE_PER_MONTH
            ]);
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

    it('charges the six prices the owner set on 2026-09-03 (HOS-975)', () => {
        // Literals on BOTH sides on purpose. This used to read
        // `expect(basico.monthlyPriceArs).toBe(COMMERCE_VERTICAL_MONTHLY_PRICE_ARS)`,
        // which asserted that two references to one constant were equal — it
        // would have stayed green through any repricing at all, which is the
        // one thing a price test exists to catch. The constant is gone (the two
        // verticals no longer share a price); these numbers are the owner's.
        expect(GASTRONOMY_BASICO_PLAN.monthlyPriceArs).toBe(3_000_000); // ARS $30.000
        expect(GASTRONOMY_PRO_PLAN.monthlyPriceArs).toBe(6_500_000); // ARS $65.000
        expect(GASTRONOMY_PREMIUM_PLAN.monthlyPriceArs).toBe(8_000_000); // ARS $80.000
        expect(EXPERIENCE_BASICO_PLAN.monthlyPriceArs).toBe(1_500_000); // ARS $15.000
        expect(EXPERIENCE_PRO_PLAN.monthlyPriceArs).toBe(3_500_000); // ARS $35.000
        expect(EXPERIENCE_PREMIUM_PLAN.monthlyPriceArs).toBe(5_000_000); // ARS $50.000
    });

    it('prices each vertical as a strictly ascending ladder (HOS-975)', () => {
        // The property that makes the three tiers a LADDER rather than three
        // unrelated products, and the one an accidental digit slip breaks
        // without breaking anything else: a `-pro` cheaper than `-basico` would
        // still seed, still check out, and still be charged.
        for (const catalogue of [ALL_GASTRONOMY_PLANS, ALL_EXPERIENCE_PLANS]) {
            const prices = catalogue.map((p) => p.monthlyPriceArs);
            expect(prices).toEqual([...prices].sort((a, b) => a - b));
            expect(new Set(prices).size).toBe(prices.length);
        }
    });

    it('keeps premium a superset of básico that costs more (HOS-818 → HOS-1058 → HOS-975)', () => {
        // HOS-818's swap of the sellable role from premium to básico was only
        // safe because nobody already paying LOST anything by it, originally
        // asserted as "the two tiers are identical". HOS-1058 made them differ
        // for the first time (premium grants the printable ficha, básico does
        // not), so the invariant became the direction that protects a payer:
        // premium ⊇ básico.
        //
        // HOS-975 is what makes the price side of that meaningful. Premium is
        // on sale again and is no longer priced identically to básico, so
        // "same price" is replaced by the assertion that actually has to hold
        // for a dearer tier to be honest: it costs MORE and gives at least as
        // much. The LISTING cap and the trial stay byte-identical — the cap
        // because one listing per owner is still the whole commercial substance
        // of §6.8, the trial because no tier of either vertical sells a
        // different one. The AI-chat limit is deliberately EXCLUDED from that
        // byte-identity (HOS-400): only premium grants `AI_CHAT`, so its quota
        // is the one place premium and básico are meant to differ, and a
        // superset check must not demand equality on the one limit that proves
        // the entitlement gate actually means something.
        for (const [basico, premium] of [
            [GASTRONOMY_BASICO_PLAN, GASTRONOMY_PREMIUM_PLAN],
            [EXPERIENCE_BASICO_PLAN, EXPERIENCE_PREMIUM_PLAN]
        ] as const) {
            expect(premium.isActive).toBe(true);
            expect(premium.monthlyPriceArs).toBeGreaterThan(basico.monthlyPriceArs);
            expect(basico.limits[0]).toEqual(premium.limits[0]);
            expect(basico.limits[1]?.value).toBe(0);
            expect(premium.limits[1]?.value).toBeGreaterThan(basico.limits[1]?.value ?? 0);
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

    it('grants the experience certificate from experience-PRO upwards, and nowhere else (HOS-1057)', () => {
        // Same shape as the HOS-1058 assertion above, one tier lower and one
        // vertical narrower. Three halves, each catching a different mistake:
        //
        // - `-pro` and `-premium` carry it: fails if the grant is dropped, or
        //   if `-premium` is left out on the assumption that a dearer tier
        //   inherits from the cheaper one. Nothing composes these arrays.
        // - `experience-basico` does not: fails if the key is moved into
        //   `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`, which would hand it to the
        //   ONLY sellable experience tier there is — i.e. to every paying
        //   experience owner, while the gate kept looking like it worked.
        // - No gastronomy tier does: a restaurant has nothing to certify, and
        //   this is the assertion that keeps that true if someone later widens
        //   `extraEntitlements` by copy-paste across verticals.
        expect(EXPERIENCE_PRO_PLAN.entitlements).toContain(
            EntitlementKey.ISSUE_EXPERIENCE_CERTIFICATE
        );
        expect(EXPERIENCE_PREMIUM_PLAN.entitlements).toContain(
            EntitlementKey.ISSUE_EXPERIENCE_CERTIFICATE
        );

        expect(EXPERIENCE_BASICO_PLAN.entitlements).not.toContain(
            EntitlementKey.ISSUE_EXPERIENCE_CERTIFICATE
        );
        for (const plan of ALL_GASTRONOMY_PLANS) {
            expect(plan.entitlements).not.toContain(EntitlementKey.ISSUE_EXPERIENCE_CERTIFICATE);
        }
    });

    it('grants the venue events agenda from gastronomy-pro upwards only (HOS-1042)', () => {
        // Same two load-bearing halves as the ficha test above, one tier lower
        // and one vertical narrower.
        //
        // The negative half carries a THIRD case the ficha's does not: the two
        // experience tiers. An experience IS an event with a date, so it has no
        // second agenda to hang off itself — a key leaking there would not be a
        // mis-priced feature, it would be a nonsensical one.
        expect(GASTRONOMY_PRO_PLAN.entitlements).toContain(EntitlementKey.MANAGE_GASTRONOMY_EVENTS);
        expect(GASTRONOMY_PREMIUM_PLAN.entitlements).toContain(
            EntitlementKey.MANAGE_GASTRONOMY_EVENTS
        );

        for (const plan of [
            GASTRONOMY_BASICO_PLAN,
            EXPERIENCE_BASICO_PLAN,
            EXPERIENCE_PRO_PLAN,
            EXPERIENCE_PREMIUM_PLAN
        ]) {
            expect(plan.entitlements).not.toContain(EntitlementKey.MANAGE_GASTRONOMY_EVENTS);
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

    it('grants EVERY tier the same 30-day trial every accommodation plan gets (HOS-590, HOS-975)', () => {
        // Asserted across all six since HOS-975, not just the two entry tiers:
        // `experience-pro` was the last tier carrying the `hasTrial: false`
        // default, which only ever meant "not sellable yet". Making it sellable
        // without the trial its five siblings carry would have been an asymmetry
        // nobody decided.
        for (const plan of [...ALL_GASTRONOMY_PLANS, ...ALL_EXPERIENCE_PLANS]) {
            expect(plan.hasTrial).toBe(true);
            expect(plan.trialDays).toBe(COMMERCE_TRIAL_DAYS);
        }
        expect(COMMERCE_TRIAL_DAYS).toBe(30);
    });

    it('leaves NO tier unpriced or dark (HOS-975)', () => {
        // The inverse of the assertion this replaces. Until HOS-975 a tier that
        // had not been priced carried `monthlyPriceArs: 0` and shipped inactive,
        // and the test named those tiers and locked their zeroes; the owner
        // priced and activated the last three, so the honest assertion is that
        // the set is now empty AND that every tier is genuinely priced.
        //
        // The two halves matter separately. `seedCommercePlan` skips the
        // `billing_prices` row for a tier priced at zero, and the commerce
        // checkout hard-throws `NO_MONTHLY_PRICE` when that row is missing — so
        // an `isActive: true` tier at price 0 is not a cheap plan, it is a plan
        // that 502s the first buyer who picks it.
        const dark = [...ALL_GASTRONOMY_PLANS, ...ALL_EXPERIENCE_PLANS].filter(
            (plan) => !plan.isActive
        );
        expect(dark.map((p) => p.slug)).toEqual([]);

        for (const plan of [...ALL_GASTRONOMY_PLANS, ...ALL_EXPERIENCE_PLANS]) {
            expect(plan.monthlyPriceArs).toBeGreaterThan(0);
        }
    });
});
