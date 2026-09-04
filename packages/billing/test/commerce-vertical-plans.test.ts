/**
 * Per-vertical commerce catalogue tests (HOS-688 §6.8).
 *
 * The commercial substance of §6.8 used to be a single number — one listing per
 * owner per vertical, the same `1` on all six rows. Since HOS-975 it is a
 * LADDER, different per vertical (gastronomy 1/3/5, experiences 1/5/10), and
 * every layer beneath it still resolves an unknown limit key to *unlimited*
 * without raising anything. These tests lock the SHAPE of the catalogue (which
 * keys each tier declares, which tier is sellable, what is deliberately
 * absent); the end-to-end assertion that the cap is actually enforced lives in
 * `apps/api` (AC-30), because a shape test here would pass just as happily with
 * the middleware unwired.
 *
 * Note the two things asserted by ABSENCE, both deliberate:
 * - a tier declares its OWN listing cap and its OWN vertical's AI-chat cap
 *   (HOS-400) — never the other vertical's, and never `-1` for either. Both
 *   read as unlimited downstream, but an absent key reads as "this plan does
 *   not meter that", which is what is true. Since HOS-975 it also carries the
 *   seven inherited `TOURIST_VIP_LIMITS`, which is a different claim: those are
 *   metered, at the tourist tier's own values.
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
    GASTRONOMY_PRO_PLAN,
    TOURIST_VIP_ENTITLEMENTS
} from '../src/config/plans.config.js';
import { COMMERCE_TRIAL_DAYS } from '../src/constants/billing.constants.js';
import { EntitlementKey } from '../src/types/entitlement.types.js';
import type { PlanDefinition } from '../src/types/plan.types.js';
import { LimitKey } from '../src/types/plan.types.js';

/**
 * The seven limit keys every commerce tier inherits from `TOURIST_VIP_LIMITS`
 * since HOS-975 D-A, spelled out so this file states the shape it is locking
 * rather than importing the constant it is checking against.
 */
const INHERITED_TOURIST_VIP_LIMIT_KEYS = [
    LimitKey.MAX_FAVORITES,
    LimitKey.MAX_ACTIVE_ALERTS,
    LimitKey.MAX_COMPARE_ITEMS,
    LimitKey.MAX_AI_SEARCH_PER_MONTH,
    LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH,
    LimitKey.MAX_SEARCH_HISTORY_ENTRIES,
    LimitKey.MAX_COLLECTIONS
] as const;

/**
 * Reads one limit's value BY KEY.
 *
 * Every assertion in this file used to index `limits[0]` / `limits[1]`, which
 * was true only while a tier declared exactly its own two keys in that order.
 * HOS-975's tourist-VIP inheritance prepends seven, so `limits[0]` silently
 * became `max_favorites: -1` and three tests started asserting against the
 * wrong number. Reading by key is what makes the order an implementation
 * detail — the same lesson HOS-329 cost on the plan comparison table, where
 * position-mapped cells made `owner-premium` inherit `owner-pro`'s values the
 * moment a plan was deactivated.
 */
function limitValue(plan: PlanDefinition, key: LimitKey): number | undefined {
    return plan.limits.find((l) => l.key === key)?.value;
}

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

    it('declares its own two limit keys plus the seven inherited tourist-VIP ones (HOS-400, HOS-975)', () => {
        // HOS-400 added a second limit of the tier's OWN to every catalogue: the
        // vertical's AI-chat quota, declared even by tiers that grant zero of it
        // (see `commerceVerticalTier`'s doc — an omitted key would read as
        // UNLIMITED downstream, not zero). HOS-975 D-A then prepended the seven
        // `TOURIST_VIP_LIMITS`, so "exactly two" became "exactly nine".
        //
        // Asserted as a SET rather than an ordered list. The order is what three
        // assertions in this file were accidentally relying on, and pinning it
        // here would re-create that coupling one merge later. What has to hold
        // is membership and the absence of anything else — a key that appears
        // from nowhere is a plan metering something nobody decided it should.
        for (const [catalogue, ownCap, ownChat] of [
            [
                ALL_GASTRONOMY_PLANS,
                LimitKey.MAX_GASTRONOMIES,
                LimitKey.MAX_AI_CHAT_GASTRONOMY_PER_MONTH
            ],
            [
                ALL_EXPERIENCE_PLANS,
                LimitKey.MAX_EXPERIENCES,
                LimitKey.MAX_AI_CHAT_EXPERIENCE_PER_MONTH
            ]
        ] as const) {
            for (const plan of catalogue) {
                const keys = plan.limits.map((l) => l.key);
                expect(new Set(keys)).toEqual(
                    new Set([ownCap, ownChat, ...INHERITED_TOURIST_VIP_LIMIT_KEYS])
                );
                // No key is declared twice — `mergeLimits` collapses by key, and
                // a duplicate would make "which value wins" depend on order.
                expect(keys).toHaveLength(new Set(keys).size);
            }
        }
    });

    it('inherits the tourist-VIP limit VALUES, not just the keys (HOS-975 D-A)', () => {
        // The half that is easy to ship broken and impossible to notice. The
        // engine reads an ABSENT key as UNLIMITED, so granting the 15 tourist
        // entitlements while omitting these seven would hand every commerce
        // owner an uncapped `max_ai_search_per_month` — a quota a paying
        // tourist-VIP holds at 200. Values, not merely presence, is what makes
        // the inheritance real.
        for (const plan of [...ALL_GASTRONOMY_PLANS, ...ALL_EXPERIENCE_PLANS]) {
            expect(limitValue(plan, LimitKey.MAX_AI_SEARCH_PER_MONTH)).toBe(200);
            expect(limitValue(plan, LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH)).toBe(200);
            expect(limitValue(plan, LimitKey.MAX_SEARCH_HISTORY_ENTRIES)).toBe(200);
            expect(limitValue(plan, LimitKey.MAX_COLLECTIONS)).toBe(25);
            expect(limitValue(plan, LimitKey.MAX_COMPARE_ITEMS)).toBe(5);
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

    it('caps the entry tier at one listing, and steps each ladder above it (HOS-975)', () => {
        // The entry tier's `1` is unchanged and is the number every commerce
        // row carried until HOS-975. What changed is everything above it: the
        // cap is now the axis that separates the three tiers of a vertical,
        // which is what this factory's own doc always said it was for.
        //
        // The two ladders are deliberately DIFFERENT lengths (owner decision,
        // 2026-09-04). Asserting them as literals per vertical rather than
        // deriving one from the other is the point — a shared shape would make
        // "gastronomy accidentally got experiences' cap" invisible.
        expect(limitValue(GASTRONOMY_BASICO_PLAN, LimitKey.MAX_GASTRONOMIES)).toBe(1);
        expect(limitValue(GASTRONOMY_PRO_PLAN, LimitKey.MAX_GASTRONOMIES)).toBe(3);
        expect(limitValue(GASTRONOMY_PREMIUM_PLAN, LimitKey.MAX_GASTRONOMIES)).toBe(5);

        expect(limitValue(EXPERIENCE_BASICO_PLAN, LimitKey.MAX_EXPERIENCES)).toBe(1);
        expect(limitValue(EXPERIENCE_PRO_PLAN, LimitKey.MAX_EXPERIENCES)).toBe(5);
        expect(limitValue(EXPERIENCE_PREMIUM_PLAN, LimitKey.MAX_EXPERIENCES)).toBe(10);
    });

    it('steps each vertical cap as a strictly ascending ladder (HOS-975)', () => {
        // The same property the price test asserts, on the other axis, and it
        // breaks the same silent way: a `-pro` capped BELOW `-basico` would
        // seed, check out and charge more for less. `-1` is excluded on
        // purpose — an unlimited tier would satisfy "ascending" only by
        // accident of sorting, and no commerce tier is meant to be uncapped.
        for (const [catalogue, capKey] of [
            [ALL_GASTRONOMY_PLANS, LimitKey.MAX_GASTRONOMIES],
            [ALL_EXPERIENCE_PLANS, LimitKey.MAX_EXPERIENCES]
        ] as const) {
            const caps = catalogue.map((p) => limitValue(p, capKey));
            for (const cap of caps) {
                expect(cap).toBeGreaterThan(0);
            }
            expect(caps).toEqual([...caps].sort((a, b) => (a ?? 0) - (b ?? 0)));
            expect(new Set(caps).size).toBe(caps.length);
        }
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
        // much.
        //
        // Until HOS-975 the LISTING cap was asserted here as byte-identical
        // between the two tiers, because one listing per owner was the whole
        // commercial substance of §6.8 and every row carried `1`. That is now
        // the opposite of what has to hold: the cap is the axis the ladder
        // steps on, so premium must allow strictly MORE, not the same. The
        // trial stays identical — no tier of either vertical sells a different
        // one. The AI-chat quota is likewise a place they are MEANT to differ
        // (HOS-400): only premium grants `AI_CHAT`, so demanding equality there
        // would blunt the one limit that proves the entitlement gate means
        // something.
        for (const [basico, premium, capKey, chatKey] of [
            [
                GASTRONOMY_BASICO_PLAN,
                GASTRONOMY_PREMIUM_PLAN,
                LimitKey.MAX_GASTRONOMIES,
                LimitKey.MAX_AI_CHAT_GASTRONOMY_PER_MONTH
            ],
            [
                EXPERIENCE_BASICO_PLAN,
                EXPERIENCE_PREMIUM_PLAN,
                LimitKey.MAX_EXPERIENCES,
                LimitKey.MAX_AI_CHAT_EXPERIENCE_PER_MONTH
            ]
        ] as const) {
            expect(premium.isActive).toBe(true);
            expect(premium.monthlyPriceArs).toBeGreaterThan(basico.monthlyPriceArs);
            expect(limitValue(premium, capKey) ?? 0).toBeGreaterThan(
                limitValue(basico, capKey) ?? 0
            );
            expect(limitValue(basico, chatKey)).toBe(0);
            expect(limitValue(premium, chatKey) ?? 0).toBeGreaterThan(
                limitValue(basico, chatKey) ?? 0
            );
            expect(basico.hasTrial).toBe(premium.hasTrial);
            expect(basico.trialDays).toBe(premium.trialDays);
            for (const key of basico.entitlements) {
                expect(premium.entitlements).toContain(key);
            }
            // Every limit básico declares, premium declares too — the same
            // superset direction, on the axis the entitlement loop above does
            // not cover. A dearer tier silently missing a cap its cheaper
            // neighbour has would read as UNLIMITED, not as "inherited".
            for (const l of basico.limits) {
                expect(limitValue(premium, l.key)).toBeDefined();
            }
        }
    });

    it('grants the whole tourist-VIP block on ALL SIX tiers (HOS-975 D-A)', () => {
        // A commerce owner is a tourist on this platform too, exactly like an
        // accommodation owner. Before this, commerce was the only owner
        // catalogue whose floor excluded these 15 keys, which made them an
        // accidental privilege of accommodation rather than anyone's decision.
        //
        // Asserted per TIER, not per catalogue: the block is the FLOOR, so a
        // single tier missing it is the failure this exists to catch, and a
        // catalogue-level flatMap would hide it behind its siblings.
        for (const plan of [...ALL_GASTRONOMY_PLANS, ...ALL_EXPERIENCE_PLANS]) {
            for (const key of TOURIST_VIP_ENTITLEMENTS) {
                expect(plan.entitlements).toContain(key);
            }
            // No key twice. `dedupe` collapses nothing today (the three sources
            // are disjoint), which is exactly why a duplicate appearing later
            // would go unnoticed without this line.
            expect(plan.entitlements).toHaveLength(new Set(plan.entitlements).size);
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
