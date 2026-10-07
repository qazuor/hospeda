/**
 * Recommendation Candidate Scorer (SPEC-284 T-004)
 *
 * Pure function that scores a candidate accommodation against a
 * {@link RecommendationProfile} across the five weighted components defined
 * in spec §5.4 (destination 40, type 20, price 20, amenities 15, quality 5),
 * and a companion helper that scores + ranks a whole candidate list. No DB
 * access, no side effects — suitable for unit testing in isolation and for
 * reuse by the feed service layer (SPEC-284 T-005).
 *
 * @module services/recommendation/recommendation.scorer
 */
import type {
    RecommendationCandidateAccommodation,
    RecommendationProfile,
    RecommendationScoreBreakdown,
    ScoredAccommodation
} from '@repo/schemas';
import { ScoredAccommodationSchema } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Destination path lookup contract
// ---------------------------------------------------------------------------

/**
 * Maps a destination UUID to its materialized path string (e.g.
 * `/argentina/entre-rios/concepcion-del-uruguay`), one path segment per
 * ancestor level in root-to-leaf order (spec's destination hierarchy:
 * COUNTRY, REGION, PROVINCE, DEPARTMENT, CITY, TOWN, NEIGHBORHOOD).
 *
 * Neither {@link RecommendationCandidateAccommodation} nor a profile's
 * `preferredDestinations` entries carry this path — only `destinationId` —
 * so the caller (the feed service) is responsible for resolving this map via
 * the destination model, covering the candidate's own `destinationId` AND
 * every `destinationId` referenced in `profile.preferredDestinations`. A
 * missing entry is NOT an error here: {@link scoreCandidateAccommodation}
 * treats it defensively as "no destination overlap" (score 0 for that
 * comparison) rather than throwing, since candidates/profiles used in tests
 * (and, defensively, in production if the caller's map construction ever
 * misses an id) may reference destinations with no resolved path.
 */
export type DestinationPathLookup = Record<string, string>;

// ---------------------------------------------------------------------------
// Destination component (0-40, spec §5.4) — tier point constants
// ---------------------------------------------------------------------------

/**
 * Points awarded when the candidate and a preferred destination share a
 * materialized-path prefix through the CITY level or deeper (TOWN,
 * NEIGHBORHOOD collapse into this tier — spec §5.4 only names 4 tiers).
 */
export const DESTINATION_CITY_MATCH_POINTS = 40;

/**
 * Points awarded when the shared prefix reaches PROVINCE or DEPARTMENT but
 * not CITY. DEPARTMENT is intentionally collapsed into the PROVINCE tier —
 * spec §5.4's weight table only names "city > province > region > country",
 * and a department-level match is closer to a province match than to a
 * region match from a tourist's mental model of "where am I going".
 */
export const DESTINATION_PROVINCE_MATCH_POINTS = 24;

/** Points awarded when the shared prefix reaches REGION only. */
export const DESTINATION_REGION_MATCH_POINTS = 12;

/** Points awarded when the shared prefix reaches COUNTRY only. */
export const DESTINATION_COUNTRY_MATCH_POINTS = 4;

/** Maximum points for the destination component (spec §5.4). */
export const DESTINATION_MAX_POINTS = 40;

/** Maximum points for the type component (spec §5.4). */
export const TYPE_MAX_POINTS = 20;

/** Maximum points for the price component (spec §5.4). */
const PRICE_MAX_POINTS = 20;

/**
 * Half-credit awarded to the price component when there is no usable price
 * signal to compare (missing candidate price, missing profile range, or a
 * currency mismatch). A judgment call: absence of signal is treated as
 * NEUTRAL rather than a negative match — we have no evidence the candidate's
 * price is a bad fit, only that we cannot evaluate it, so it should neither
 * be rewarded nor punished relative to a confirmed in-range match.
 */
const PRICE_NEUTRAL_POINTS = 10;

/** Maximum points for the amenities component (spec §5.4). */
const AMENITIES_MAX_POINTS = 15;

/** Maximum points for the quality component (spec §5.4). */
const QUALITY_MAX_POINTS = 5;

/**
 * Portion of the quality component driven by `averageRating` (spec §5.4:
 * "average_rating / is_featured — tie-break + editorial boost"). Rating is
 * the primary, user-generated quality signal, so it gets the larger 4-of-5
 * share; `isFeatured` is an editorial nudge worth at most 1 point — enough
 * to break a near-tie but never enough to outweigh a real rating gap.
 */
const QUALITY_RATING_PORTION_MAX = 4;

/** Flat bonus added when `isFeatured` is true (see {@link QUALITY_RATING_PORTION_MAX}). */
const QUALITY_FEATURED_BONUS = 1;

// ---------------------------------------------------------------------------
// Destination component
// ---------------------------------------------------------------------------

/** Splits a materialized path into its segments, dropping empty leading/trailing parts. */
const splitPathSegments = (path: string): string[] =>
    path.split('/').filter((segment) => segment.length > 0);

/**
 * Counts how many leading segments two path-segment arrays have in common,
 * stopping at the first mismatch (or the shorter array's end).
 */
const commonPrefixLength = (a: string[], b: string[]): number => {
    const maxLength = Math.min(a.length, b.length);
    let count = 0;
    while (count < maxLength && a[count] === b[count]) {
        count += 1;
    }
    return count;
};

/** Maps a `commonPrefixLength` to its destination tier point value. */
const destinationTierPoints = (length: number): number => {
    if (length >= 5) {
        return DESTINATION_CITY_MATCH_POINTS;
    }
    if (length === 3 || length === 4) {
        return DESTINATION_PROVINCE_MATCH_POINTS;
    }
    if (length === 2) {
        return DESTINATION_REGION_MATCH_POINTS;
    }
    if (length === 1) {
        return DESTINATION_COUNTRY_MATCH_POINTS;
    }
    return 0;
};

/**
 * Scores the destination component (0-40, spec §5.4): compares the
 * candidate's destination path against EACH preferred destination's path and
 * returns the MAX tier score across all of them.
 *
 * MAX (not a weighted average) is a deliberate choice: a candidate that
 * strongly matches ONE known-liked destination should not be diluted just
 * because the profile also carries an unrelated preferred destination — the
 * user demonstrably likes this place, regardless of what else they've
 * shown interest in.
 */
const scoreDestination = (
    candidate: RecommendationCandidateAccommodation,
    profile: RecommendationProfile,
    destinationPaths: DestinationPathLookup
): number => {
    if (profile.preferredDestinations.length === 0) {
        return 0;
    }

    const candidatePath = destinationPaths[candidate.destinationId];
    if (!candidatePath) {
        return 0;
    }
    const candidateSegments = splitPathSegments(candidatePath);

    let maxScore = 0;
    for (const preference of profile.preferredDestinations) {
        const preferredPath = destinationPaths[preference.destinationId];
        if (!preferredPath) {
            continue;
        }
        const preferredSegments = splitPathSegments(preferredPath);
        const tierScore = destinationTierPoints(
            commonPrefixLength(candidateSegments, preferredSegments)
        );
        if (tierScore > maxScore) {
            maxScore = tierScore;
        }
    }

    return Math.min(maxScore, DESTINATION_MAX_POINTS);
};

// ---------------------------------------------------------------------------
// Type component
// ---------------------------------------------------------------------------

/**
 * Scores the type component (0-20, spec §5.4): proportional share of the
 * profile's total type weight that the candidate's exact type accounts for.
 * Guards the divide-by-zero case explicitly (empty `preferredTypes`).
 */
const scoreType = (
    candidate: RecommendationCandidateAccommodation,
    profile: RecommendationProfile
): number => {
    const totalWeight = profile.preferredTypes.reduce(
        (sum, preference) => sum + preference.weight,
        0
    );
    if (totalWeight === 0) {
        return 0;
    }
    const match = profile.preferredTypes.find((preference) => preference.type === candidate.type);
    if (!match) {
        return 0;
    }
    return (match.weight / totalWeight) * TYPE_MAX_POINTS;
};

// ---------------------------------------------------------------------------
// Price component
// ---------------------------------------------------------------------------

/**
 * Scores the price component (0-20, spec §5.4).
 *
 * Neutral (half-credit, {@link PRICE_NEUTRAL_POINTS}) when there is nothing
 * to compare: no candidate price, no profile price signal at all, or a
 * currency mismatch (cross-currency comparison is meaningless without FX
 * conversion, which this pure function deliberately does not perform).
 *
 * Otherwise, full credit when the price falls within `[min, max]`
 * (inclusive), decaying LINEARLY to 0 as the price moves away from the
 * nearest bound: `score = 20 * max(0, 1 - distance / (2 * rangeWidth))`,
 * where `distance` is how far the price sits past the nearest bound and
 * `rangeWidth` is `max - min` (floored at 1 to avoid divide-by-zero when
 * `min === max`, a degenerate but valid single-price-point range). At
 * `distance === 2 * rangeWidth` the score has decayed fully to 0.
 *
 * When only one bound is known (e.g. `min` set, `max` null — spec allows a
 * profile to carry a partial range), the missing side is treated as
 * unbounded: no penalty in that direction, full credit for any price past
 * the known bound in the unbounded direction. Decay off the known bound
 * still applies, using that bound's own magnitude (floored at 1) as the
 * `rangeWidth` proxy, since there is no second bound to derive a width from.
 */
const scorePrice = (
    candidate: RecommendationCandidateAccommodation,
    profile: RecommendationProfile
): number => {
    const price = candidate.price?.price;
    if (price === undefined || price === null) {
        return PRICE_NEUTRAL_POINTS;
    }

    const { min, max, currency } = profile.priceRange;
    if (min === null && max === null) {
        return PRICE_NEUTRAL_POINTS;
    }

    const candidateCurrency = candidate.price?.currency;
    if (currency && candidateCurrency && currency !== candidateCurrency) {
        return PRICE_NEUTRAL_POINTS;
    }

    const decay = (distance: number, rangeWidth: number): number =>
        PRICE_MAX_POINTS * Math.max(0, 1 - distance / (2 * rangeWidth));

    if (min !== null && max !== null) {
        if (price >= min && price <= max) {
            return PRICE_MAX_POINTS;
        }
        const rangeWidth = Math.max(max - min, 1);
        const distance = price < min ? min - price : price - max;
        return decay(distance, rangeWidth);
    }

    if (min !== null) {
        if (price >= min) {
            return PRICE_MAX_POINTS;
        }
        const rangeWidth = Math.max(min, 1);
        return decay(min - price, rangeWidth);
    }

    // max !== null (min === null is guaranteed by the earlier both-null guard)
    if (max !== null) {
        if (price <= max) {
            return PRICE_MAX_POINTS;
        }
        const rangeWidth = Math.max(max, 1);
        return decay(price - max, rangeWidth);
    }

    return PRICE_NEUTRAL_POINTS;
};

// ---------------------------------------------------------------------------
// Amenities component
// ---------------------------------------------------------------------------

/**
 * Scores the amenities component (0-15, spec §5.4): plain Jaccard overlap
 * between the candidate's amenity set and the profile's frequent-amenity
 * set. No frequency weighting — spec §5.4 explicitly names "Jaccard
 * overlap", so this stays deliberately simple. Guards the empty/empty case
 * (union size 0) to avoid `NaN`.
 */
const scoreAmenities = (
    candidate: RecommendationCandidateAccommodation,
    profile: RecommendationProfile
): number => {
    const candidateSet = new Set(candidate.amenityIds);
    const profileSet = new Set(profile.frequentAmenities.map((preference) => preference.amenityId));

    const union = new Set<string>([...candidateSet, ...profileSet]);
    if (union.size === 0) {
        return 0;
    }

    let intersectionSize = 0;
    for (const amenityId of candidateSet) {
        if (profileSet.has(amenityId)) {
            intersectionSize += 1;
        }
    }

    return (intersectionSize / union.size) * AMENITIES_MAX_POINTS;
};

// ---------------------------------------------------------------------------
// Quality component
// ---------------------------------------------------------------------------

/**
 * Scores the quality component (0-5, spec §5.4): up to 4 points from
 * `averageRating` normalized to a 5-point scale, plus a flat 1-point bonus
 * when `isFeatured` is true, capped at 5 total. See
 * {@link QUALITY_RATING_PORTION_MAX} for the rationale behind the 4+1 split.
 */
const scoreQuality = (candidate: RecommendationCandidateAccommodation): number => {
    const rating = candidate.averageRating ?? 0;
    const ratingPortion = Math.min(
        Math.max((rating / 5) * QUALITY_RATING_PORTION_MAX, 0),
        QUALITY_RATING_PORTION_MAX
    );
    const featuredBonus = candidate.isFeatured ? QUALITY_FEATURED_BONUS : 0;
    return Math.min(ratingPortion + featuredBonus, QUALITY_MAX_POINTS);
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Input to {@link scoreCandidateAccommodation}. */
export interface ScoreCandidateAccommodationInput {
    /** The candidate accommodation to score. */
    candidate: RecommendationCandidateAccommodation;
    /** The user's preference profile to score the candidate against. */
    profile: RecommendationProfile;
    /**
     * Destination-id-to-materialized-path lookup. Must cover the candidate's
     * own `destinationId` and every `destinationId` in
     * `profile.preferredDestinations` for accurate scoring; missing entries
     * degrade gracefully to a 0 destination-comparison rather than throwing.
     */
    destinationPaths: DestinationPathLookup;
}

/**
 * Scores a single candidate accommodation against a preference profile
 * across the five weighted components defined in spec §5.4, and returns the
 * full breakdown plus the summed `totalScore` (0-100).
 *
 * Pure function: no DB access, no I/O, no side effects. Safe to call with a
 * cold/empty profile (see spec §5.5) — it is not this function's
 * responsibility to detect cold-start and substitute a fallback query (that
 * is the feed service's job, SPEC-284 T-005); this function simply yields
 * low/zero component scores for an empty profile without crashing.
 *
 * The output is validated via {@link ScoredAccommodationSchema.parse} before
 * being returned, mirroring the defensive pattern used by
 * `buildRecommendationProfile` (SPEC-284 T-003) — this throws early if a bug
 * in the component math ever produces an out-of-bounds value instead of
 * silently shipping a corrupt score downstream.
 *
 * @example
 * ```ts
 * const scored = scoreCandidateAccommodation({
 *   candidate,
 *   profile,
 *   destinationPaths: { [candidate.destinationId]: '/argentina/entre-rios/...' },
 * });
 * // scored.totalScore -> 0-100
 * ```
 */
export const scoreCandidateAccommodation = (
    input: ScoreCandidateAccommodationInput
): ScoredAccommodation => {
    const { candidate, profile, destinationPaths } = input;

    const score: RecommendationScoreBreakdown = {
        destination: scoreDestination(candidate, profile, destinationPaths),
        type: scoreType(candidate, profile),
        price: scorePrice(candidate, profile),
        amenities: scoreAmenities(candidate, profile),
        quality: scoreQuality(candidate)
    };

    const totalScore = Math.min(
        score.destination + score.type + score.price + score.amenities + score.quality,
        100
    );

    return ScoredAccommodationSchema.parse({
        accommodation: candidate,
        score,
        totalScore
    });
};

/** Input to {@link scoreAndRankCandidates}. */
export interface ScoreAndRankCandidatesInput {
    /** Candidate accommodations to score. */
    candidates: RecommendationCandidateAccommodation[];
    /** The user's preference profile to score every candidate against. */
    profile: RecommendationProfile;
    /** Destination path lookup — see {@link ScoreCandidateAccommodationInput.destinationPaths}. */
    destinationPaths: DestinationPathLookup;
}

/**
 * Scores every candidate in `candidates` against `profile` (via
 * {@link scoreCandidateAccommodation}) and returns them sorted by
 * `totalScore` descending. Ties preserve the original input order (a stable
 * sort keyed on the original index), so callers can rely on upstream
 * ordering (e.g. "most recently listed first") as the tie-break.
 *
 * @example
 * ```ts
 * const ranked = scoreAndRankCandidates({ candidates, profile, destinationPaths });
 * // ranked[0] has the highest totalScore
 * ```
 */
export const scoreAndRankCandidates = (
    input: ScoreAndRankCandidatesInput
): ScoredAccommodation[] => {
    const { candidates, profile, destinationPaths } = input;

    return candidates
        .map((candidate, index) => ({
            index,
            scored: scoreCandidateAccommodation({ candidate, profile, destinationPaths })
        }))
        .sort((a, b) => b.scored.totalScore - a.scored.totalScore || a.index - b.index)
        .map((entry) => entry.scored);
};
