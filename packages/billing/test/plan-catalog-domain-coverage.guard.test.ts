/**
 * Guard: every business-vertical plan catalogue is registered where the
 * catalogue-wide defenses look (HOS-1290).
 *
 * ## What this defends against
 *
 * `ALL_PLANS` is deliberately accommodation+tourist-only (SPEC-239
 * isolation) — that is correct and must stay that way. The bug HOS-1290 found
 * is that three DIFFERENT defenses (the startup config validator, the Model C
 * seed-sync engine, and any test claiming "every plan" exhaustively) each
 * independently narrowed their own scope to `ALL_PLANS`, so the six
 * commerce-vertical plans and the three partner plans quietly sat outside all
 * three at once. `ALL_PLAN_CATALOGS` is the fix: a registry of every plan
 * catalogue the platform maintains, which those defenses now walk instead of
 * `ALL_PLANS` alone.
 *
 * A registry is only as good as its own completeness, though — a catalogue
 * added to `plans.config.ts` and never added to `ALL_PLAN_CATALOGS` would
 * recreate the exact same hole this issue fixes, just one catalogue later.
 * This guard is the tripwire for that: it does not special-case any single
 * catalogue by name. Instead it cross-checks the SET OF PRODUCT DOMAINS that
 * `ALL_PLAN_CATALOGS` actually contains a plan for against
 * `BUSINESS_VERTICAL_PRODUCT_DOMAINS` — the independent, enum-level source of
 * truth for "how many sellable verticals does the platform have" (owned by
 * `@repo/schemas`, not by this package). Two independent lists agreeing is
 * what "nobody crossed the aisle-and-vigilance decisions" (the issue's own
 * diagnosis) looks like fixed.
 *
 * ## What this guard does NOT prove
 *
 * It proves every vertical HAS a catalogue registered, and that no stray
 * plan claims a domain outside the known vertical list. It does NOT prove
 * `validateBillingConfig()` or the seed actually CALL `ALL_PLAN_CATALOGS` —
 * that regression is covered by `config-validator-source.test.ts` and
 * `commercePlan.seed.test.ts` / `partnerPlan.seed.test.ts` respectively, each
 * exercising the real code path with a config-error / DB-drift fixture.
 *
 * ## No exceptions, no allowlist (HOS-1280 precedent)
 *
 * Unlike guards that carry a documented exclusion list, this one has none:
 * every member of `BUSINESS_VERTICAL_PRODUCT_DOMAINS` MUST have at least one
 * plan in `ALL_PLAN_CATALOGS`, full stop. `ADDON` is correctly absent from
 * both sides — it is a billing mechanism, not a vertical
 * (`BUSINESS_VERTICAL_PRODUCT_DOMAINS`'s own doc says so) — so it is never
 * expected to own a plan catalogue at all.
 */
import { BUSINESS_VERTICAL_PRODUCT_DOMAINS, ProductDomainEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    ALL_EXPERIENCE_PLANS,
    ALL_GASTRONOMY_PLANS,
    ALL_PARTNER_PLANS,
    ALL_PLAN_CATALOGS,
    ALL_PLANS
} from '../src/config/plans.config.js';

describe('ALL_PLAN_CATALOGS (HOS-1290)', () => {
    it('registers exactly the four catalogue arrays, each referenced by identity', () => {
        // Identity, not shape — a copy of ALL_PLANS with the same plans in a
        // different array would pass a deep-equal check but silently stop
        // being "the same living export" (a future edit to ALL_PLANS itself
        // would then diverge from what the validator/seed actually walk).
        expect(ALL_PLAN_CATALOGS).toHaveLength(4);
        expect(ALL_PLAN_CATALOGS).toContain(ALL_PLANS);
        expect(ALL_PLAN_CATALOGS).toContain(ALL_GASTRONOMY_PLANS);
        expect(ALL_PLAN_CATALOGS).toContain(ALL_EXPERIENCE_PLANS);
        expect(ALL_PLAN_CATALOGS).toContain(ALL_PARTNER_PLANS);
    });

    it('flattens to exactly the sum of its catalogues, with no duplicate plan object', () => {
        const flat = ALL_PLAN_CATALOGS.flat();
        const expectedLength =
            ALL_PLANS.length +
            ALL_GASTRONOMY_PLANS.length +
            ALL_EXPERIENCE_PLANS.length +
            ALL_PARTNER_PLANS.length;

        expect(flat).toHaveLength(expectedLength);
        expect(new Set(flat).size).toBe(flat.length);
    });

    it('every plan slug is unique across every catalogue combined', () => {
        const flat = ALL_PLAN_CATALOGS.flat();
        const slugs = flat.map((plan) => plan.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('covers every BUSINESS_VERTICAL_PRODUCT_DOMAINS member with at least one plan', () => {
        // The cross-check: the enum-level "how many verticals exist" list
        // (owned by @repo/schemas, decided independently of this file) must
        // be fully covered by the catalogue-level "every plan the seed
        // maintains" list (owned here). A vertical added to one side and not
        // the other fails this test immediately, on EITHER side.
        const domainsWithAPlan = new Set(
            ALL_PLAN_CATALOGS.flat().map((plan) => plan.productDomain)
        );

        for (const domain of BUSINESS_VERTICAL_PRODUCT_DOMAINS) {
            expect(
                domainsWithAPlan.has(domain),
                `Product domain "${domain}" is a BUSINESS_VERTICAL_PRODUCT_DOMAINS member with no plan in any ALL_PLAN_CATALOGS entry`
            ).toBe(true);
        }
    });

    it('never carries a plan for a domain outside BUSINESS_VERTICAL_PRODUCT_DOMAINS', () => {
        // The inverse direction: a plan filed under a domain the platform
        // does not recognize as a sellable vertical (a typo, or a plan
        // accidentally stamped with the ADDON billing-mechanism domain) is
        // just as much a bug as a missing vertical.
        const verticalSet = new Set<string>(BUSINESS_VERTICAL_PRODUCT_DOMAINS);

        for (const plan of ALL_PLAN_CATALOGS.flat()) {
            expect(
                verticalSet.has(plan.productDomain),
                `Plan "${plan.slug}" declares product_domain "${plan.productDomain}", which is not in BUSINESS_VERTICAL_PRODUCT_DOMAINS`
            ).toBe(true);
        }
    });

    it('pins the current vertical count so a 6th vertical is a conscious edit, not a silent pass', () => {
        // Tripwire, not a ceiling: this is expected to be bumped the day a
        // 6th vertical ships, same as every other pinned-count guard in this
        // repo. Its job is to force the person adding a vertical to look at
        // THIS file and confirm ALL_PLAN_CATALOGS was updated too, not to
        // block a 6th vertical from ever existing.
        expect(BUSINESS_VERTICAL_PRODUCT_DOMAINS).toHaveLength(5);
        expect(BUSINESS_VERTICAL_PRODUCT_DOMAINS).toEqual([
            ProductDomainEnum.ACCOMMODATION,
            ProductDomainEnum.GASTRONOMY,
            ProductDomainEnum.EXPERIENCE,
            ProductDomainEnum.PARTNER,
            ProductDomainEnum.TOURIST
        ]);
    });
});
