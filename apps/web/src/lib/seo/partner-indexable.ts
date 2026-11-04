/**
 * @file partner-indexable.ts
 * @description Single source of truth for partner page and sitemap indexability.
 */

/** Why a partner page is not indexable, or `null` when it is. */
export type PartnerNotIndexableReason = 'not-visible' | 'missing-description';

/** Optional public partner fields needed to decide indexability. */
export interface PartnerIndexabilityInput {
    /** Whether the owner currently holds the public-page entitlement. */
    readonly hasPublicPage?: boolean | null;
    /** The live description. Blank means the page would be thin content. */
    readonly description?: string | null;
}

/** The verdict, plus the single condition that failed. */
export interface PartnerIndexabilityResult {
    readonly isIndexable: boolean;
    readonly reason: PartnerNotIndexableReason | null;
}

/**
 * Decide whether a partner page may be indexed and listed in the sitemap.
 *
 * @param input - Public partner data from the page or carousel.
 * @returns The verdict and the failing condition.
 */
export function evaluatePartnerIndexability(
    input: PartnerIndexabilityInput
): PartnerIndexabilityResult {
    if (input.hasPublicPage !== true) {
        return { isIndexable: false, reason: 'not-visible' };
    }

    if (!input.description || input.description.trim().length === 0) {
        return { isIndexable: false, reason: 'missing-description' };
    }

    return { isIndexable: true, reason: null };
}
