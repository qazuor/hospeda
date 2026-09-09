/**
 * `classifyLimitKeyAgainstPlanDomain` — the predicate that stops a plan change
 * in one vertical from rewriting another vertical's cap (HOS-1279).
 *
 * ---
 * WHAT THE FUNCTION IS DEFENDING
 *
 * `handlePlanChangeAddonRecalculation` recomputes every active add-on cap as
 * `newPlan.limits[limitKey] ?? 0` plus the add-on's increase. A plan from one
 * vertical does not DECLARE another vertical's caps, so that `?? 0` resolved a
 * foreign cap's base to zero and wrote the stomped value back — silently, with
 * no error anywhere, because zero is a perfectly valid base.
 *
 * This file pins the classification itself. The service-level regression (a
 * host whose gastronomy cap survives an accommodation plan change, and the
 * mirror image) lives in
 * `apps/api/test/services/addon-plan-change.domain-isolation.test.ts`.
 *
 * ---
 * WHY THE ASSERTIONS BELOW NAME REAL KEYS AND NOT FIXTURES
 *
 * The whole mechanism rests on `productDomainForLimitKey` being exhaustive over
 * `LimitKey`. A test written against invented keys would pass identically
 * against a broken map, since every invented key answers `undefined` either way.
 * So every key here is a real enum member and every domain a real
 * `ProductDomainEnum` value.
 *
 * @module test/billing/addon-plan-change.domain-isolation
 */

import { LimitKey } from '@repo/billing';
import { ProductDomainEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { classifyLimitKeyAgainstPlanDomain } from '../../src/services/billing/addon/addon-plan-change.helpers.js';

describe('classifyLimitKeyAgainstPlanDomain — owned', () => {
    it.each([
        ['accommodation listing cap', LimitKey.MAX_ACCOMMODATIONS, ProductDomainEnum.ACCOMMODATION],
        [
            'accommodation photo cap',
            LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
            ProductDomainEnum.ACCOMMODATION
        ],
        ['gastronomy listing cap', LimitKey.MAX_GASTRONOMIES, ProductDomainEnum.GASTRONOMY],
        [
            'gastronomy AI-chat cap',
            LimitKey.MAX_AI_CHAT_GASTRONOMY_PER_MONTH,
            ProductDomainEnum.GASTRONOMY
        ],
        ['experience listing cap', LimitKey.MAX_EXPERIENCES, ProductDomainEnum.EXPERIENCE],
        [
            'experience private-gallery cap',
            LimitKey.MAX_ACTIVE_PRIVATE_GALLERIES,
            ProductDomainEnum.EXPERIENCE
        ]
    ])('lets a plan change touch its own %s', (_label, limitKey, planDomain) => {
        expect(classifyLimitKeyAgainstPlanDomain({ limitKey, planDomain })).toEqual({
            kind: 'owned'
        });
    });
});

describe('classifyLimitKeyAgainstPlanDomain — foreign', () => {
    it('refuses the gastronomy cap during an ACCOMMODATION plan change', () => {
        // THE BUG, stated as one assertion. Before HOS-1279 this pair reached
        // `newPlanLimits['max_gastronomies'] ?? 0` on an accommodation plan —
        // which does not declare the key — and wrote back `0 + increase`.
        expect(
            classifyLimitKeyAgainstPlanDomain({
                limitKey: LimitKey.MAX_GASTRONOMIES,
                planDomain: ProductDomainEnum.ACCOMMODATION
            })
        ).toEqual({ kind: 'foreign', limitDomain: ProductDomainEnum.GASTRONOMY });
    });

    it('refuses the accommodation cap during a GASTRONOMY plan change', () => {
        // The mirror image, and it is not hypothetical: the commerce
        // plan-change route reaches the same recalculation through
        // `applyTrialingPlanUpgrade`.
        expect(
            classifyLimitKeyAgainstPlanDomain({
                limitKey: LimitKey.MAX_ACCOMMODATIONS,
                planDomain: ProductDomainEnum.GASTRONOMY
            })
        ).toEqual({ kind: 'foreign', limitDomain: ProductDomainEnum.ACCOMMODATION });
    });

    it('keeps the two commerce verticals apart from EACH OTHER, not just from accommodation', () => {
        // `'commerce'` was one bucket until HOS-692 split it. A predicate that
        // only separated commerce from accommodation would pass every other
        // test in this file and still let a gastronomy plan change stomp an
        // experience cap.
        expect(
            classifyLimitKeyAgainstPlanDomain({
                limitKey: LimitKey.MAX_EXPERIENCES,
                planDomain: ProductDomainEnum.GASTRONOMY
            })
        ).toEqual({ kind: 'foreign', limitDomain: ProductDomainEnum.EXPERIENCE });

        expect(
            classifyLimitKeyAgainstPlanDomain({
                limitKey: LimitKey.MAX_GASTRONOMIES,
                planDomain: ProductDomainEnum.EXPERIENCE
            })
        ).toEqual({ kind: 'foreign', limitDomain: ProductDomainEnum.GASTRONOMY });
    });

    it('refuses every commerce cap during a PARTNER plan change', () => {
        // Partner plans declare `limits: []`, so nothing they own can ever be
        // the right answer here.
        for (const limitKey of [
            LimitKey.MAX_GASTRONOMIES,
            LimitKey.MAX_EXPERIENCES,
            LimitKey.MAX_ACCOMMODATIONS
        ]) {
            expect(
                classifyLimitKeyAgainstPlanDomain({
                    limitKey,
                    planDomain: ProductDomainEnum.PARTNER
                }).kind
            ).toBe('foreign');
        }
    });
});

describe('classifyLimitKeyAgainstPlanDomain — unclassified (fails CLOSED)', () => {
    it.each([
        ['a near-miss typo', 'max_gastronomys'],
        ['a retired key', 'max_commerce_listings'],
        ['an empty string', ''],
        ['a plausible-looking invention', 'max_partners']
    ])('refuses %s rather than resolving it to accommodation', (_label, limitKey) => {
        const verdict = classifyLimitKeyAgainstPlanDomain({
            limitKey,
            planDomain: ProductDomainEnum.ACCOMMODATION
        });

        expect(verdict.kind).toBe('unclassified');
        // Spelled out because 'owned' under an ACCOMMODATION plan is exactly
        // what the deleted `?? ACCOMMODATION` produced: a confident, wrong
        // answer that recalculated a cap off a plan that never declared it.
        expect(verdict.kind).not.toBe('owned');
    });

    it('refuses when the PLAN could not be placed, even for a perfectly good limit key', () => {
        // The other half of the fail-closed rule. `max_accommodations` is a
        // real, unambiguous key — it is the plan side that is missing here, and
        // an unplaceable plan cannot be said to own anything.
        expect(
            classifyLimitKeyAgainstPlanDomain({
                limitKey: LimitKey.MAX_ACCOMMODATIONS,
                planDomain: undefined
            })
        ).toEqual({ kind: 'unclassified', limitDomain: ProductDomainEnum.ACCOMMODATION });
    });
});

describe('classifyLimitKeyAgainstPlanDomain — the shared TOURIST_VIP_LIMITS block', () => {
    // These five are why HOS-1279 shipped no migration. They are declared by
    // plans in FOUR domains (every accommodation plan, both tourist plans, all
    // six commerce tiers all spread `TOURIST_VIP_LIMITS` whole), and a customer
    // has ONE favorites allowance rather than one per vertical — so a domain
    // COLUMN on `billing_customer_limits` would have had no correct value to
    // write for them.
    //
    // `PRODUCT_DOMAIN_BY_LIMIT_KEY` files all five under accommodation and
    // documents that as indifferent-today. This test does not endorse that
    // choice; it pins the consequence, so the day the mapping moves, the
    // plan-change behaviour that follows from it moves visibly rather than
    // quietly.
    const TOURIST_BLOCK = [
        LimitKey.MAX_FAVORITES,
        LimitKey.MAX_ACTIVE_ALERTS,
        LimitKey.MAX_COMPARE_ITEMS,
        LimitKey.MAX_SEARCH_HISTORY_ENTRIES,
        LimitKey.MAX_COLLECTIONS
    ];

    it('places all five in one domain, so no plan change can see two answers for one cap', () => {
        const verdicts = TOURIST_BLOCK.map(
            (limitKey) =>
                classifyLimitKeyAgainstPlanDomain({
                    limitKey,
                    planDomain: ProductDomainEnum.ACCOMMODATION
                }).kind
        );

        expect(verdicts).toEqual(['owned', 'owned', 'owned', 'owned', 'owned']);
        // Non-vacuity: the list is not empty, so the map above actually ran.
        expect(TOURIST_BLOCK).toHaveLength(5);
    });

    it('treats them as foreign to a commerce plan change, which is what keeps the cap intact', () => {
        // A commerce tier DOES declare these keys (it spreads
        // `TOURIST_VIP_LIMITS`), so a naive "is the key in the new plan?" check
        // would have happily recalculated them from the commerce tier. They are
        // refused on the DOMAIN instead, which is the stricter and correct
        // reading: the customer's one allowance is not this vertical's to move.
        for (const limitKey of TOURIST_BLOCK) {
            expect(
                classifyLimitKeyAgainstPlanDomain({
                    limitKey,
                    planDomain: ProductDomainEnum.GASTRONOMY
                }).kind
            ).toBe('foreign');
        }
    });
});
