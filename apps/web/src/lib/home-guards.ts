/**
 * @file Home page guard helpers.
 * @description Pure helpers used by the homepage to decide whether optional
 * UI fragments (e.g. hero social proof) should render. Extracted from
 * `apps/web/src/pages/[lang]/index.astro` so the logic is unit-testable
 * without spinning up Astro.
 */

/**
 * Input shape for {@link shouldShowSocialProof}.
 */
export type ShouldShowSocialProofInput = {
    /** Total number of reviews used as the "people trusted us" signal. */
    readonly reviewsCount: number;
    /**
     * Average rating across all reviews. May be `0`, `NaN`, `undefined` or
     * `Infinity` when the upstream stats endpoint has not produced a usable
     * value yet (cold start, empty DB, division by zero, etc.).
     */
    readonly averageRating: number | undefined;
};

/**
 * Decide whether the hero "social proof" block should render.
 *
 * Renders only when there is at least one review AND the average rating is
 * a finite, strictly positive number. Anything else (zero reviews, zero
 * rating, `NaN`, `Infinity`, `undefined`) hides the block so we never leak
 * "0+", "0/5" or "NaN/5" into the UI.
 *
 * @param input - {@link ShouldShowSocialProofInput}
 * @returns `true` when both signals are present and meaningful, `false`
 *          otherwise.
 *
 * @example
 * shouldShowSocialProof({ reviewsCount: 5, averageRating: 4.2 }); // true
 * shouldShowSocialProof({ reviewsCount: 0, averageRating: 4.5 }); // false
 * shouldShowSocialProof({ reviewsCount: 5, averageRating: 0 });   // false
 * shouldShowSocialProof({ reviewsCount: 5, averageRating: NaN }); // false
 */
export function shouldShowSocialProof({
    reviewsCount,
    averageRating
}: ShouldShowSocialProofInput): boolean {
    if (reviewsCount <= 0) return false;
    if (typeof averageRating !== 'number') return false;
    if (!Number.isFinite(averageRating)) return false;
    if (averageRating <= 0) return false;
    return true;
}
