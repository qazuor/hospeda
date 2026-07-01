/**
 * Recommendation Profile Builder (SPEC-284 T-003)
 *
 * Pure function that fuses three already-fetched, already-windowed/capped
 * behavioral signals (favorites, recently-viewed accommodations, and search
 * history) into a single weighted {@link RecommendationProfile}. No DB access,
 * no side effects — suitable for unit testing in isolation and for reuse by
 * the recommendation scorer (SPEC-284 T-004).
 *
 * See `.qtm/specs/SPEC-284-recommendations-feed/spec.md` §5.2–5.3 for the
 * product rationale behind the signal weights and the fusion approach.
 *
 * @module services/recommendation/recommendation.profile
 */
import type {
    AccommodationTypePreference,
    DestinationPreference,
    PricePreference,
    RecommendationCandidateAccommodation,
    RecommendationProfile,
    SearchHistoryFilters
} from '@repo/schemas';
import { RecommendationProfileSchema } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Signal weights (spec §5.2)
// ---------------------------------------------------------------------------

/**
 * Weight applied to every attribute contributed by a favorited accommodation.
 * Favorites are an explicit, non-expiring act of preference — the strongest
 * signal in the fusion (spec §5.2 weight table).
 */
export const FAVORITE_SIGNAL_WEIGHT = 3;

/**
 * Weight applied to every attribute contributed by a recently-viewed
 * accommodation. Views are passive and noisy compared to favorites/searches,
 * hence the lowest weight (spec §5.2 weight table).
 */
export const RECENTLY_VIEWED_SIGNAL_WEIGHT = 1;

/**
 * Weight applied to every attribute contributed by a search-history entry's
 * `filtersJson`. Searches express explicit, time-bound intent — weighted
 * between favorites and views (spec §5.2 weight table).
 */
export const SEARCH_HISTORY_SIGNAL_WEIGHT = 2;

// ---------------------------------------------------------------------------
// Input shape (RO-RO)
// ---------------------------------------------------------------------------

/**
 * Input to {@link buildRecommendationProfile}.
 *
 * All three lists are expected to already be windowed and capped by the
 * caller per spec §5.2 (favorites: last 20 no window; recently-viewed: last
 * 30d cap 25; search history: last 30d cap 10). This function does NOT
 * re-apply those limits — it only aggregates whatever it is given.
 */
export interface BuildRecommendationProfileInput {
    /** Already-capped list of the user's favorited accommodations (weight 3). */
    favoriteAccommodations: RecommendationCandidateAccommodation[];
    /** Already-capped list of the user's recently-viewed accommodations (weight 1). */
    recentlyViewedAccommodations: RecommendationCandidateAccommodation[];
    /**
     * Already-capped list of the user's recent search-history filter sets
     * (weight 2). May be empty — search history is a degradable signal
     * (spec §5.2): the profile still builds correctly from the other two.
     */
    searchHistoryFilters: SearchHistoryFilters[];
}

// ---------------------------------------------------------------------------
// Internal weighted-aggregation helpers
// ---------------------------------------------------------------------------

/** A single weighted numeric observation (used for the price bounds). */
interface WeightedValue {
    value: number;
    weight: number;
}

/**
 * Accumulates `weight` into `map` at `key`, summing with any existing value.
 * Shared by the destination/type/amenity aggregators below.
 */
const accumulateWeight = <K>(map: Map<K, number>, key: K, weight: number): void => {
    map.set(key, (map.get(key) ?? 0) + weight);
};

/**
 * Computes the weight-normalized average of a list of weighted values.
 * Returns `null` when the list is empty or the total weight is zero (no
 * signal to average).
 */
const weightedAverage = (values: WeightedValue[]): number | null => {
    if (values.length === 0) {
        return null;
    }
    const totalWeight = values.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight === 0) {
        return null;
    }
    const weightedSum = values.reduce((sum, v) => sum + v.value * v.weight, 0);
    return weightedSum / totalWeight;
};

/**
 * Picks the majority-weight currency from the accumulated per-currency
 * weight map. Ties are broken by first occurrence (Map iteration order,
 * i.e. the earliest-processed signal wins). Returns `undefined` when no
 * signal carried a currency.
 */
const pickDominantCurrency = (currencyWeights: Map<string, number>): string | undefined => {
    let winner: string | undefined;
    let winnerWeight = Number.NEGATIVE_INFINITY;
    for (const [currency, weight] of currencyWeights) {
        if (weight > winnerWeight) {
            winner = currency;
            winnerWeight = weight;
        }
    }
    return winner;
};

/** Converts a weight map into a sorted (highest weight first) preference array. */
const toDestinationPreferences = (weights: Map<string, number>): DestinationPreference[] =>
    Array.from(weights.entries())
        .map(([destinationId, weight]) => ({ destinationId, weight }))
        .sort((a, b) => b.weight - a.weight);

/** Converts a weight map into a sorted (highest weight first) preference array. */
const toTypePreferences = (
    weights: Map<AccommodationTypePreference['type'], number>
): AccommodationTypePreference[] =>
    Array.from(weights.entries())
        .map(([type, weight]) => ({ type, weight }))
        .sort((a, b) => b.weight - a.weight);

/** Converts a weight map into a sorted (highest weight first) preference array. */
const toAmenityPreferences = (weights: Map<string, number>) =>
    Array.from(weights.entries())
        .map(([amenityId, weight]) => ({ amenityId, weight }))
        .sort((a, b) => b.weight - a.weight);

// ---------------------------------------------------------------------------
// Aggregation state
// ---------------------------------------------------------------------------

/** Mutable accumulators shared while walking the three input signals. */
interface ProfileAccumulator {
    destinationWeights: Map<string, number>;
    typeWeights: Map<AccommodationTypePreference['type'], number>;
    amenityWeights: Map<string, number>;
    minPriceSignals: WeightedValue[];
    maxPriceSignals: WeightedValue[];
    currencyWeights: Map<string, number>;
}

const createAccumulator = (): ProfileAccumulator => ({
    destinationWeights: new Map(),
    typeWeights: new Map(),
    amenityWeights: new Map(),
    minPriceSignals: [],
    maxPriceSignals: [],
    currencyWeights: new Map()
});

/**
 * Folds one favorite/recently-viewed accommodation's attributes into the
 * accumulator at the given weight (spec §5.3: "favorites and recently-viewed
 * contribute the attributes of their items").
 *
 * A candidate's price (when present) is treated as a single point the user
 * has shown affinity for, so it contributes to BOTH the min-signal and the
 * max-signal pools — see the price-range derivation note on
 * {@link buildRecommendationProfile}.
 */
const foldCandidateAccommodation = (
    accumulator: ProfileAccumulator,
    candidate: RecommendationCandidateAccommodation,
    weight: number
): void => {
    accumulateWeight(accumulator.destinationWeights, candidate.destinationId, weight);
    accumulateWeight(accumulator.typeWeights, candidate.type, weight);
    for (const amenityId of candidate.amenityIds) {
        accumulateWeight(accumulator.amenityWeights, amenityId, weight);
    }

    const price = candidate.price?.price;
    if (price !== undefined) {
        accumulator.minPriceSignals.push({ value: price, weight });
        accumulator.maxPriceSignals.push({ value: price, weight });
        if (candidate.price?.currency) {
            accumulateWeight(accumulator.currencyWeights, candidate.price.currency, weight);
        }
    }
};

/**
 * Folds one search-history entry's `filtersJson` into the accumulator at the
 * given base weight (spec §5.3: "search history contributes its filters_json
 * directly").
 *
 * Two distinct dilution rules apply to the base weight, both documented here
 * because they are judgment calls not spelled out verbatim in the spec:
 *  - `types` (multi-select) expresses OR-alternatives ("any of these"), so
 *    the base weight is split evenly across the selected types. Otherwise a
 *    broad multi-type search would out-weigh a focused single-type search
 *    for the same base weight, which does not reflect stronger intent.
 *  - `amenities` (multi-select) expresses AND-required filters ("all of
 *    these"), so each amenity gets the FULL base weight, undiluted — every
 *    required amenity is an independent, genuine signal of interest.
 */
const foldSearchHistoryFilters = (
    accumulator: ProfileAccumulator,
    filters: SearchHistoryFilters,
    baseWeight: number
): void => {
    if (filters.destinationId) {
        accumulateWeight(accumulator.destinationWeights, filters.destinationId, baseWeight);
    }

    if (filters.type) {
        accumulateWeight(accumulator.typeWeights, filters.type, baseWeight);
    }
    if (filters.types && filters.types.length > 0) {
        const perTypeWeight = baseWeight / filters.types.length;
        for (const type of filters.types) {
            accumulateWeight(accumulator.typeWeights, type, perTypeWeight);
        }
    }

    if (filters.amenities) {
        for (const amenityId of filters.amenities) {
            accumulateWeight(accumulator.amenityWeights, amenityId, baseWeight);
        }
    }

    if (filters.minPrice !== undefined) {
        accumulator.minPriceSignals.push({ value: filters.minPrice, weight: baseWeight });
    }
    if (filters.maxPrice !== undefined) {
        accumulator.maxPriceSignals.push({ value: filters.maxPrice, weight: baseWeight });
    }
    if (filters.currency) {
        accumulateWeight(accumulator.currencyWeights, filters.currency, baseWeight);
    }
};

/**
 * Derives the profile's price range from the accumulated min/max signal
 * pools (spec §5.3).
 *
 * Approach chosen (a judgment call — the spec says "derive a price range
 * from the weighted inputs" without prescribing a formula): each signal
 * contributes independently to a "floor" pool and a "ceiling" pool.
 *  - A single-price point (favorite/recently-viewed) contributes to BOTH
 *    pools — it says "I like accommodations priced around here", so it
 *    pulls both the floor and the ceiling toward itself.
 *  - An explicit `minPrice`/`maxPrice` search filter contributes to only
 *    the matching pool — it is an explicit bound, not a point.
 *
 * `min` is the weighted average of the floor pool, `max` is the weighted
 * average of the ceiling pool. This yields a band around the weighted
 * center that widens when signals disagree (e.g. cheap favorites + a search
 * for expensive listings) and narrows when they agree (repeated similarly
 * priced items). The two bounds are computed independently and may end up
 * with `min > max` when the underlying signals genuinely conflict; that
 * conflict is surfaced as-is — resolving it is the scorer's concern
 * (spec §5.4), not the profile builder's.
 */
const derivePriceRange = (accumulator: ProfileAccumulator): PricePreference => {
    const min = weightedAverage(accumulator.minPriceSignals);
    const max = weightedAverage(accumulator.maxPriceSignals);
    const currency = pickDominantCurrency(accumulator.currencyWeights);

    return {
        min,
        max,
        ...(currency ? { currency: currency as PricePreference['currency'] } : {})
    };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds a weighted {@link RecommendationProfile} from a user's favorites,
 * recently-viewed accommodations, and search history (SPEC-284 §5.2–5.3).
 *
 * Pure function: no DB access, no I/O, no side effects. The caller is
 * responsible for fetching and windowing/capping the three input lists
 * (favorites: last 20 no window; recently-viewed: last 30d cap 25; search
 * history: last 30d cap 10 — spec §5.2); this function only aggregates.
 *
 * Cold-start (spec §5.5): when every preference list ends up empty AND the
 * price range is fully unknown (both bounds `null`), the returned profile
 * has `isCold: true` and the caller should fall back to the popular/featured
 * feed instead of scoring against it. This is computed from the RESULTING
 * aggregates rather than from raw input array lengths, so a search-history
 * entry with no usable fields (e.g. `{}`) does not, by itself, prevent a
 * cold profile.
 *
 * @example
 * ```ts
 * const profile = buildRecommendationProfile({
 *   favoriteAccommodations: [candidate1, candidate2],
 *   recentlyViewedAccommodations: [candidate3],
 *   searchHistoryFilters: [{ destinationId: 'uuid-...', minPrice: 10000 }],
 * });
 * ```
 */
export const buildRecommendationProfile = (
    input: BuildRecommendationProfileInput
): RecommendationProfile => {
    const accumulator = createAccumulator();

    for (const candidate of input.favoriteAccommodations) {
        foldCandidateAccommodation(accumulator, candidate, FAVORITE_SIGNAL_WEIGHT);
    }
    for (const candidate of input.recentlyViewedAccommodations) {
        foldCandidateAccommodation(accumulator, candidate, RECENTLY_VIEWED_SIGNAL_WEIGHT);
    }
    for (const filters of input.searchHistoryFilters) {
        foldSearchHistoryFilters(accumulator, filters, SEARCH_HISTORY_SIGNAL_WEIGHT);
    }

    const preferredDestinations = toDestinationPreferences(accumulator.destinationWeights);
    const preferredTypes = toTypePreferences(accumulator.typeWeights);
    const frequentAmenities = toAmenityPreferences(accumulator.amenityWeights);
    const priceRange = derivePriceRange(accumulator);

    const isCold =
        preferredDestinations.length === 0 &&
        preferredTypes.length === 0 &&
        frequentAmenities.length === 0 &&
        priceRange.min === null &&
        priceRange.max === null;

    return RecommendationProfileSchema.parse({
        preferredDestinations,
        preferredTypes,
        priceRange,
        frequentAmenities,
        isCold
    });
};
