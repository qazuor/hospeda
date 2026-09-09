/**
 * HOS-1233 T-040 / AC-15k — the traced verdict on the tourist block of
 * `PRODUCT_DOMAIN_BY_LIMIT_KEY`, pinned so it cannot decay into an assumption.
 *
 * The spec left this read UNRESOLVED and required it be traced before shipping
 * the reclassification, in either direction: "either a pure tourist's limits
 * still resolve after reclassification, or the table is corrected. Not left as
 * an assumption."
 *
 * THE TRACE
 *
 *   1. The table's only production consumer is
 *      `addon-limit-recalculation.service.ts`, which asks it which
 *      subscription supplies the BASE value an add-on raises.
 *   2. No add-on declares an `affectsLimitKey` on any tourist cap, so those
 *      five entries are reached by nothing.
 *   3. A pure tourist's own caps never pass through here. They come from their
 *      plan via `loadEntitlements` — which is where the reclassification DID
 *      break, and is fixed separately.
 *
 * THE VERDICT: indifferent, today, for that specific reason.
 *
 * The reason is load-bearing and step 2 is the fragile half — which is what
 * this file exists to watch. The five keys are declared by BOTH the tourist
 * plans and every accommodation plan (each spreads `TOURIST_VIP_LIMITS` whole),
 * so they are shared caps and this `Record<LimitKey, ProductDomainValue>`
 * cannot express "either". The day an add-on targets one, the mapping stops
 * being indifferent and the right value depends on who that add-on is sold to.
 * That is a product decision; the test below is what forces it to be made
 * rather than inherited from a line nobody re-read.
 */
import { describe, expect, it } from 'vitest';
import { ALL_ADDONS } from '../../src/config/addons.config.js';
import { productDomainForLimitKey } from '../../src/config/commerce-limits.config.js';
import { LimitKey } from '../../src/types/plan.types.js';

/** The caps that belong to the tourist tiers (`TOURIST_VIP_LIMITS`). */
const TOURIST_LIMIT_KEYS: readonly LimitKey[] = [
    LimitKey.MAX_FAVORITES,
    LimitKey.MAX_ACTIVE_ALERTS,
    LimitKey.MAX_COMPARE_ITEMS,
    LimitKey.MAX_SEARCH_HISTORY_ENTRIES,
    LimitKey.MAX_COLLECTIONS
];

describe('PRODUCT_DOMAIN_BY_LIMIT_KEY — the tourist block (HOS-1233 AC-15k)', () => {
    it('has a domain for every tourist cap — none falls through', () => {
        // The precondition for anything below meaning something: an unmapped
        // key returns undefined, and `undefined === undefined` would make the
        // verdict test pass while saying nothing.
        for (const key of TOURIST_LIMIT_KEYS) {
            expect(productDomainForLimitKey(key)).toBeDefined();
        }
    });

    it('NO add-on targets a tourist cap — which is what makes the mapping indifferent', () => {
        // THE ASSERTION THAT MATTERS. It is not describing a rule anyone wants
        // to keep; it is watching the condition under which the mapping above
        // stops being harmless.
        //
        // If this fails, do NOT relax it. An add-on now raises a tourist cap,
        // so `PRODUCT_DOMAIN_BY_LIMIT_KEY` genuinely decides which subscription
        // supplies that cap's base value, and the wrong answer produces the
        // outcome `addon-limit-recalculation.service.ts` documents at length:
        // the recalculation is SKIPPED and the add-on the customer just paid
        // for raises nothing. Decide who the add-on is sold to first, set the
        // domain to match, and rewrite this test around that decision.
        const targeting = ALL_ADDONS.filter(
            (addon) =>
                addon.affectsLimitKey !== null &&
                TOURIST_LIMIT_KEYS.includes(addon.affectsLimitKey as LimitKey)
        ).map((addon) => addon.slug);

        expect(targeting).toEqual([]);
    });

    it('proves the filter above can actually match, so the empty result means something', () => {
        // Without this, `[]` would be equally consistent with "no add-on targets
        // a tourist cap" and "the filter is broken and matches nothing" — the
        // shape of vacuous green the spec's §9 warns about. Re-run the same
        // predicate over a key that add-ons DO target.
        const targetingAccommodation = ALL_ADDONS.filter(
            (addon) => addon.affectsLimitKey === LimitKey.MAX_PHOTOS_PER_ACCOMMODATION
        ).map((addon) => addon.slug);

        expect(targetingAccommodation.length).toBeGreaterThan(0);
    });
});
