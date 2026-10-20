/**
 * @file partner-indexable.ts
 * @description Keeps partner pages out of the index and sitemap until V7
 * restores the public page on the partner's public key.
 */

/** Why a partner page is not indexable, or `null` when it is. */
export type PartnerNotIndexableReason = 'not-visible';

/** Input retained for the page and sitemap call sites. */
export interface PartnerIndexabilityInput {
    readonly lifecycleState?: string | null;
    readonly description?: string | null;
}

/** The verdict, plus the single condition that failed. */
export interface PartnerIndexabilityResult {
    readonly isIndexable: boolean;
    readonly reason: PartnerNotIndexableReason | null;
}

/**
 * Partner detail pages remain dark until V7 restores them on the public key.
 *
 * @param input - The caller's public partner data.
 * @returns A non-indexable verdict while the page is unavailable.
 */
export function evaluatePartnerIndexability(
    input: PartnerIndexabilityInput
): PartnerIndexabilityResult {
    void input;
    return { isIndexable: false, reason: 'not-visible' };
}
