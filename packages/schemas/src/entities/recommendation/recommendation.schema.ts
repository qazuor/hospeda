/**
 * Personalized Recommendations Feed — core entity schemas (SPEC-284)
 *
 * Defines the heuristic preference profile, the per-candidate score breakdown,
 * and the API feed envelope for the tourist-facing recommendations feature
 * (see `.qtm/specs/SPEC-284-recommendations-feed/spec.md` §5). This is the
 * single source of truth consumed by the profile builder, the scorer, the
 * service layer, the API route, and the web UI.
 *
 * Design notes:
 *  - v1 is a heuristic, rule-based recommender (no ML/embeddings) — spec §5.1.
 *  - The preference profile fuses three signals (favorites, recently-viewed,
 *    search-history) into one weighted structure — spec §5.2/§5.3.
 *  - Scoring weights sum to 100 across five components — spec §5.4.
 *  - A user with no signal at all produces a "cold" profile, which the service
 *    layer falls back to a popular/featured feed for — spec §5.5.
 */
import { z } from 'zod';
import { AmenityIdSchema, DestinationIdSchema } from '../../common/id.schema.js';
import { AccommodationTypeEnumSchema, PriceCurrencyEnumSchema } from '../../enums/index.js';
import { AccommodationSummarySchema } from '../accommodation/accommodation.query.schema.js';

// ============================================================================
// PREFERENCE PROFILE — BUILDING BLOCKS (spec §5.2–5.3)
// ============================================================================

/**
 * A single destination the user has shown affinity for, with its accumulated
 * weight (sum of the per-signal weights of every favorite/view/search that
 * referenced it — see spec §5.2 weight table).
 *
 * @example
 * ```ts
 * const pref: DestinationPreference = { destinationId: 'uuid-...', weight: 7 };
 * ```
 */
export const DestinationPreferenceSchema = z.object({
    /** Destination UUID. */
    destinationId: DestinationIdSchema,
    /** Accumulated weight across all contributing signals (non-negative). */
    weight: z.number().min(0)
});

/** TypeScript type for {@link DestinationPreferenceSchema}. */
export type DestinationPreference = z.infer<typeof DestinationPreferenceSchema>;

/**
 * A single accommodation type the user has shown affinity for, with its
 * accumulated weight.
 *
 * @example
 * ```ts
 * const pref: AccommodationTypePreference = { type: 'CABIN', weight: 4 };
 * ```
 */
export const AccommodationTypePreferenceSchema = z.object({
    /** Accommodation type. */
    type: AccommodationTypeEnumSchema,
    /** Accumulated weight across all contributing signals (non-negative). */
    weight: z.number().min(0)
});

/** TypeScript type for {@link AccommodationTypePreferenceSchema}. */
export type AccommodationTypePreference = z.infer<typeof AccommodationTypePreferenceSchema>;

/**
 * The profile's inferred nightly price range, derived from the price of
 * favorited/viewed accommodations and from `minPrice`/`maxPrice` filters in
 * recent searches.
 *
 * Both bounds are `null` when no signal carried price information (e.g. a
 * profile built purely from destination-only searches) — the scorer treats a
 * `null` bound as "no price preference" and awards full price score.
 *
 * @example
 * ```ts
 * const range: PricePreference = { min: 15000, max: 40000, currency: 'ARS' };
 * ```
 */
export const PricePreferenceSchema = z.object({
    /** Lower bound of the inferred price range, or `null` if unknown. */
    min: z.number().min(0).nullable(),
    /** Upper bound of the inferred price range, or `null` if unknown. */
    max: z.number().min(0).nullable(),
    /** Currency the range is expressed in. Absent when no signal carried one. */
    currency: PriceCurrencyEnumSchema.optional()
});

/** TypeScript type for {@link PricePreferenceSchema}. */
export type PricePreference = z.infer<typeof PricePreferenceSchema>;

/**
 * A single amenity the user has shown affinity for, with its accumulated
 * weight/frequency across contributing signals.
 *
 * @example
 * ```ts
 * const pref: AmenityPreference = { amenityId: 'uuid-pool', weight: 2 };
 * ```
 */
export const AmenityPreferenceSchema = z.object({
    /** Amenity UUID. */
    amenityId: AmenityIdSchema,
    /** Accumulated weight/frequency across all contributing signals. */
    weight: z.number().min(0)
});

/** TypeScript type for {@link AmenityPreferenceSchema}. */
export type AmenityPreference = z.infer<typeof AmenityPreferenceSchema>;

// ============================================================================
// RECOMMENDATION PROFILE (spec §5.2–5.3, §5.5)
// ============================================================================

/**
 * The weighted preference profile built from a user's favorites, recently
 * viewed accommodations, and search history (spec §5.2–5.3).
 *
 * All four preference lists may be empty independently (e.g. a user with
 * favorites but no search history still produces a valid, non-cold profile).
 * The profile is only "cold" (see {@link RecommendationProfileSchema.isCold})
 * when all three seed signals were empty at build time.
 *
 * @example
 * ```ts
 * const profile: RecommendationProfile = {
 *   preferredDestinations: [{ destinationId: 'uuid-...', weight: 7 }],
 *   preferredTypes: [{ type: 'CABIN', weight: 4 }],
 *   priceRange: { min: 15000, max: 40000, currency: 'ARS' },
 *   frequentAmenities: [{ amenityId: 'uuid-pool', weight: 2 }],
 *   isCold: false,
 * };
 * ```
 */
export const RecommendationProfileSchema = z.object({
    /** Destinations the user has shown affinity for, most-relevant first. */
    preferredDestinations: z.array(DestinationPreferenceSchema),
    /** Accommodation type(s) the user has shown affinity for. */
    preferredTypes: z.array(AccommodationTypePreferenceSchema),
    /** Inferred nightly price range. */
    priceRange: PricePreferenceSchema,
    /** Amenities the user has shown affinity for, most-relevant first. */
    frequentAmenities: z.array(AmenityPreferenceSchema),
    /**
     * `true` when the user has no favorites, no recently-viewed items, and no
     * (recent) search history — i.e. every preference list above is empty and
     * the price range is fully unknown. Signals the caller to fall back to
     * the cold-start feed (spec §5.5) instead of scoring against this profile.
     */
    isCold: z.boolean()
});

/** TypeScript type for {@link RecommendationProfileSchema}. */
export type RecommendationProfile = z.infer<typeof RecommendationProfileSchema>;

// ============================================================================
// SCORE BREAKDOWN (spec §5.4)
// ============================================================================

/**
 * Per-component score breakdown for a single candidate accommodation, scored
 * against a {@link RecommendationProfileSchema}. Components sum to at most 100
 * (spec §5.4 weight table): destination 40, type 20, price 20, amenities 15,
 * quality 5.
 *
 * @example
 * ```ts
 * const score: RecommendationScoreBreakdown = {
 *   destination: 40,
 *   type: 20,
 *   price: 14,
 *   amenities: 9,
 *   quality: 5,
 * };
 * ```
 */
export const RecommendationScoreBreakdownSchema = z.object({
    /** Destination match component (0–40). Graduated by the destinations hierarchy. */
    destination: z.number().min(0).max(40),
    /** Accommodation type match component (0–20). Exact/category match. */
    type: z.number().min(0).max(20),
    /** Price proximity component (0–20). Distance to the profile's price range. */
    price: z.number().min(0).max(20),
    /** Amenities overlap component (0–15). Jaccard overlap vs frequent amenities. */
    amenities: z.number().min(0).max(15),
    /** Quality/editorial component (0–5). `averageRating` / `isFeatured` tie-break. */
    quality: z.number().min(0).max(5)
});

/** TypeScript type for {@link RecommendationScoreBreakdownSchema}. */
export type RecommendationScoreBreakdown = z.infer<typeof RecommendationScoreBreakdownSchema>;

// ============================================================================
// CANDIDATE ACCOMMODATION
// ============================================================================

/**
 * A candidate accommodation as seen by the recommendation scorer.
 *
 * Wraps {@link AccommodationSummarySchema} (the existing public-safe summary
 * projection — `@repo/schemas` accommodation entity) instead of duplicating
 * accommodation fields, and adds the two fields the scorer needs that the
 * summary projection intentionally omits:
 *  - `destinationId` — the summary's `location` field is postal-address-only
 *    (SPEC-095); the destination FK lives on the base entity, not the summary.
 *  - `amenityIds` — required for the amenities Jaccard-overlap component
 *    (spec §5.4); the summary projection carries no relation data.
 *
 * @example
 * ```ts
 * const candidate: RecommendationCandidateAccommodation = {
 *   ...accommodationSummary,
 *   destinationId: 'uuid-...',
 *   amenityIds: ['uuid-pool', 'uuid-wifi'],
 * };
 * ```
 */
export const RecommendationCandidateAccommodationSchema = AccommodationSummarySchema.extend({
    /** Destination UUID (FK), used for the destination-hierarchy score component. */
    destinationId: DestinationIdSchema,
    /** Amenity UUIDs, used for the amenities Jaccard-overlap score component. */
    amenityIds: z.array(AmenityIdSchema)
});

/** TypeScript type for {@link RecommendationCandidateAccommodationSchema}. */
export type RecommendationCandidateAccommodation = z.infer<
    typeof RecommendationCandidateAccommodationSchema
>;

// ============================================================================
// RECOMMENDATION REASON (BETA-152)
// ============================================================================

/**
 * The dominant reason a candidate was recommended, attributed from its
 * {@link RecommendationScoreBreakdownSchema}. Drives the feed's grouping in
 * the web UI (BETA-152) — items are shown under a heading per reason instead
 * of one flat grid.
 *
 * Only the two strongest personal signals earn a dedicated group:
 *  - `DESTINATION` — the candidate strongly matches a destination the user
 *    has shown affinity for (region-level match or deeper).
 *  - `TYPE` — the candidate is of an accommodation type the user prefers.
 *
 * Everything else — a weak/country-only destination match, a price/amenities/
 * quality-driven pick, and every item of a cold-start feed (where the profile
 * is empty, so `destination` and `type` are both 0) — collapses into:
 *  - `OTHER` — "other suggestions for you" (discovery bucket).
 *
 * @example
 * ```ts
 * const reason: RecommendationReason = 'DESTINATION';
 * ```
 */
export const RecommendationReasonEnumSchema = z.enum(['DESTINATION', 'TYPE', 'OTHER']);

/** TypeScript type for {@link RecommendationReasonEnumSchema}. */
export type RecommendationReason = z.infer<typeof RecommendationReasonEnumSchema>;

// ============================================================================
// SCORED ACCOMMODATION
// ============================================================================

/**
 * A candidate accommodation paired with its score breakdown and total score,
 * as returned by the recommendation scorer for a single feed item.
 *
 * @example
 * ```ts
 * const scored: ScoredAccommodation = {
 *   accommodation: candidate,
 *   score: { destination: 40, type: 20, price: 14, amenities: 9, quality: 5 },
 *   totalScore: 88,
 *   reason: 'DESTINATION',
 * };
 * ```
 */
export const ScoredAccommodationSchema = z.object({
    /** The scored accommodation candidate. */
    accommodation: RecommendationCandidateAccommodationSchema,
    /** Per-component score breakdown. */
    score: RecommendationScoreBreakdownSchema,
    /** Sum of all score components (0–100). */
    totalScore: z.number().min(0).max(100),
    /**
     * The dominant reason this candidate was recommended, attributed from
     * `score` (BETA-152). Drives the feed's per-reason grouping in the web UI.
     *
     * Optional because a `ScoredAccommodation` is built in two phases: the pure
     * scorer (SPEC-284 T-004) produces the `score`/`totalScore`, and the
     * service layer then attributes the reason from that score. Every item that
     * actually reaches the client via the feed endpoint carries a reason; the
     * field is optional only to model that intermediate scorer output. The web
     * UI defaults a missing reason to `OTHER` defensively.
     */
    reason: RecommendationReasonEnumSchema.optional()
});

/** TypeScript type for {@link ScoredAccommodationSchema}. */
export type ScoredAccommodation = z.infer<typeof ScoredAccommodationSchema>;

// ============================================================================
// FEED RESPONSE ENVELOPE
// ============================================================================

/**
 * API response envelope for the recommendations feed endpoint.
 *
 * `isColdStart` distinguishes a personalized feed (scored against a real
 * {@link RecommendationProfileSchema}) from the popular/featured fallback feed
 * served when the profile is cold (spec §5.5) — the web UI uses this flag to
 * adjust the feed's heading/copy without needing to infer it from the data.
 *
 * @example
 * ```ts
 * const response: RecommendationFeedResponse = {
 *   items: [scoredAccommodation],
 *   isColdStart: false,
 *   generatedAt: new Date(),
 * };
 * ```
 */
export const RecommendationFeedResponseSchema = z.object({
    /** Scored accommodations, highest `totalScore` first. */
    items: z.array(ScoredAccommodationSchema),
    /**
     * `true` when this feed is the popular/featured cold-start fallback
     * (spec §5.5) rather than a profile-personalized feed.
     */
    isColdStart: z.boolean(),
    /** Timestamp when this feed was generated (UTC). */
    generatedAt: z.coerce.date()
});

/** TypeScript type for {@link RecommendationFeedResponseSchema}. */
export type RecommendationFeedResponse = z.infer<typeof RecommendationFeedResponseSchema>;
