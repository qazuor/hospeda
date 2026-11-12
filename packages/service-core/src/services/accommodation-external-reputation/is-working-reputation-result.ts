/**
 * Pure predicate that decides whether a reputation fetch counts as "working"
 * for the one-time automatic enable of the external reputation section.
 *
 * Kept in its own module because the rule is shared by two independent
 * writers — the owner-triggered inline refresh and the Apify poll cron — and
 * duplicating it would let the two paths disagree about what "working" means.
 *
 * @module services/accommodation-external-reputation/is-working-reputation-result
 */

/**
 * The listing fields that determine whether reputation data is actually
 * visible to guests.
 */
export interface WorkingReputationListing {
    /**
     * Soft-delete timestamp — deleted listings never count as visible.
     * Optional because the entity read schema models it as optional.
     */
    readonly deletedAt?: Date | null;
    /** The owner chose to show the platform link. */
    readonly showLink: boolean;
    /** The owner chose to show review snippets. */
    readonly showReviews: boolean;
}

/**
 * Input accepted by {@link isWorkingReputationResult}.
 */
export interface WorkingReputationResultInput {
    /** Persisted `fetch_status` for this fetch. */
    readonly fetchStatus: string | null | undefined;
    /** Platform aggregate rating, or `null` when unavailable. */
    readonly rating: number | null | undefined;
    /** Review snippets returned by the platform, when any. */
    readonly snippets: readonly unknown[] | null | undefined;
    /** The listing the data belongs to. */
    readonly listing: WorkingReputationListing;
}

/**
 * Returns `true` only when a fetch produced something the public page can
 * actually display for a listing guests can see.
 *
 * The four conditions are intentionally conjunctive:
 * - `fetchStatus === 'ok'` — an adapter that degraded or errored must not
 *   count as a working provider.
 * - `rating != null` OR at least one snippet — a successful empty response
 *   carries no data to show, so it must not enable the section.
 * - the listing is not soft-deleted.
 * - the listing is visible (`showLink` OR `showReviews`). A listing the owner
 *   has hidden cannot justify turning the section on for the whole
 *   accommodation.
 *
 * @param input - Fetch result plus the owning listing's visibility flags.
 * @returns `true` when the result is displayable and the listing is visible.
 *
 * @example
 * ```ts
 * isWorkingReputationResult({
 *   fetchStatus: 'ok',
 *   rating: 4.7,
 *   snippets: null,
 *   listing: { deletedAt: null, showLink: true, showReviews: false }
 * }); // true
 * ```
 */
export function isWorkingReputationResult(input: WorkingReputationResultInput): boolean {
    const { fetchStatus, rating, snippets, listing } = input;

    if (fetchStatus !== 'ok') return false;
    if (listing.deletedAt != null) return false;
    if (!listing.showLink && !listing.showReviews) return false;

    return rating != null || (snippets?.length ?? 0) > 0;
}
