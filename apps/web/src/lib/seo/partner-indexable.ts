/**
 * @file partner-indexable.ts
 * @description Single source of truth for "is this partner page indexable?".
 * The detail page (`/partners/<slug>/`) and the dynamic sitemap MUST both decide
 * with this function — never with an inline check, which is how a `noindex` page
 * ends up listed in the sitemap, or a listed URL ends up `noindex`.
 *
 * Same shape and same reasoning as `author-indexable.ts` (HOS-375 §6.5), for the
 * same reason: two callers, one predicate.
 *
 * HOS-294 D-3 / R-3.
 */

/** Why a partner page is not indexable, or `null` when it is. */
export type PartnerNotIndexableReason = 'not-gold' | 'not-visible' | 'missing-description';

/**
 * Everything the predicate needs, all of it optional.
 *
 * The two callers hold different payloads — the page has one partner's full
 * public record, the sitemap has a list item — so every field is tolerated as
 * absent. An absent field FAILS its condition: a payload that omitted the tier
 * must not be indexed on the assumption that it was gold.
 */
export interface PartnerIndexabilityInput {
    /** `partners.tier`. Only `gold` has a page at all. */
    readonly tier?: string | null;
    /** `partners.lifecycle_state`. */
    readonly lifecycleState?: string | null;
    /** `partners.subscription_status`. */
    readonly subscriptionStatus?: string | null;
    /** The live description. Blank means the page would be thin content. */
    readonly description?: string | null;
}

/** The verdict, plus the single condition that failed. */
export interface PartnerIndexabilityResult {
    readonly isIndexable: boolean;
    readonly reason: PartnerNotIndexableReason | null;
}

/**
 * Decides whether a partner's page may be indexed and listed in the sitemap.
 *
 * Four conditions, checked in the order a reader would ask them:
 *
 * 1. **gold** — the page is what separates the paid plans. A silver partner has
 *    no page, so its URL must never reach the sitemap.
 * 2. **visible** — `ACTIVE` lifecycle and an `active` subscription, the same
 *    pair every public partner read already forces. A partner who is off the
 *    carousel must not still be in the index.
 * 3. **has a description** — R-3. A page carrying only a logo and a name is
 *    thin content; two of them are the doorway-page pattern this condition
 *    exists to avoid. Whitespace does not count, or the guard would be defeated
 *    by a space bar.
 *
 * Conditions 2's two halves share one reason (`not-visible`) on purpose: from
 * the indexer's side, "revoked" and "stopped paying" are the same event — the
 * page is no longer public. The reason string is for logging and tests, not for
 * telling a partner why.
 *
 * @param input - See {@link PartnerIndexabilityInput}.
 * @returns The verdict and the failing condition.
 */
export function evaluatePartnerIndexability(
    input: PartnerIndexabilityInput
): PartnerIndexabilityResult {
    if (input.tier !== 'gold') {
        return { isIndexable: false, reason: 'not-gold' };
    }

    if (input.lifecycleState !== 'ACTIVE' || input.subscriptionStatus !== 'active') {
        return { isIndexable: false, reason: 'not-visible' };
    }

    if (!input.description || input.description.trim().length === 0) {
        return { isIndexable: false, reason: 'missing-description' };
    }

    return { isIndexable: true, reason: null };
}
