/**
 * Recommendation Reason Attribution (BETA-152)
 *
 * Pure function that attributes a single dominant {@link RecommendationReason}
 * to a scored candidate from its {@link RecommendationScoreBreakdown}. Drives
 * the feed's per-reason grouping in the web UI: instead of one flat grid, the
 * feed is shown under a heading per reason.
 *
 * Only the two strongest PERSONAL signals earn a dedicated group
 * (`DESTINATION`, `TYPE`); every weaker/editorial/cold-start pick collapses
 * into `OTHER`. See {@link attributeRecommendationReason} for the exact rule.
 *
 * No DB access, no side effects — unit-testable in isolation and safe to call
 * from the pure scorer (SPEC-284 T-004).
 *
 * @module services/recommendation/recommendation.reason
 */
import type { RecommendationReason, RecommendationScoreBreakdown } from '@repo/schemas';
import {
    DESTINATION_MAX_POINTS,
    DESTINATION_REGION_MATCH_POINTS,
    TYPE_MAX_POINTS
} from './recommendation.scorer';

/**
 * Minimum raw `destination` component score for a candidate to be grouped
 * under `DESTINATION` ("por los destinos que te gustan").
 *
 * Set to the REGION tier ({@link DESTINATION_REGION_MATCH_POINTS} = 12): a
 * bare COUNTRY-level match (4 points — e.g. "also in Argentina") is far too
 * weak to honestly claim the user is being shown this because they like the
 * destination, so it is deliberately excluded and falls through to `OTHER`.
 * A region match or deeper (province, city) is a genuine "you like this area"
 * signal.
 */
export const DESTINATION_REASON_MIN_POINTS = DESTINATION_REGION_MATCH_POINTS;

/**
 * Minimum raw `type` component score for a candidate to be grouped under
 * `TYPE` ("del tipo que preferís"). Any non-zero type score means the
 * candidate's exact type is one the user's profile weights — a genuine
 * preference match — so the threshold is just "> 0".
 */
export const TYPE_REASON_MIN_POINTS = 0;

/** Input to {@link attributeRecommendationReason}. */
export interface AttributeRecommendationReasonInput {
    /** The per-component score breakdown of the candidate. */
    readonly score: RecommendationScoreBreakdown;
}

/**
 * Attributes the dominant {@link RecommendationReason} for a scored candidate.
 *
 * Rule:
 *  1. A candidate qualifies for `DESTINATION` when its `destination` score
 *     reaches at least the region tier ({@link DESTINATION_REASON_MIN_POINTS}),
 *     and for `TYPE` when its `type` score is above zero
 *     ({@link TYPE_REASON_MIN_POINTS}).
 *  2. If BOTH qualify, the one with the higher share of its own component
 *     maximum wins (`destination / 40` vs `type / 20`) — a fair "which signal
 *     matched more strongly" comparison, since the raw maxima differ. Ties
 *     favor `DESTINATION` (spec §5.4 weights it highest at 40).
 *  3. If neither qualifies — a weak/country-only destination, a pick driven by
 *     price/amenities/quality, or a cold-start feed (empty profile ⇒ both
 *     `destination` and `type` are 0) — the reason is `OTHER`.
 *
 * Pure: depends only on `score`. Cold-start needs no special-casing — an empty
 * profile yields `destination = type = 0`, which naturally attributes `OTHER`.
 *
 * @param input - {@link AttributeRecommendationReasonInput}
 * @returns The dominant reason for the candidate.
 *
 * @example
 * ```ts
 * attributeRecommendationReason({ score: { destination: 40, type: 0, price: 10, amenities: 0, quality: 3 } })
 * // 'DESTINATION'
 * attributeRecommendationReason({ score: { destination: 4, type: 20, price: 10, amenities: 0, quality: 3 } })
 * // 'TYPE' (country-only destination is below the region threshold)
 * attributeRecommendationReason({ score: { destination: 0, type: 0, price: 10, amenities: 6, quality: 5 } })
 * // 'OTHER'
 * ```
 */
export const attributeRecommendationReason = (
    input: AttributeRecommendationReasonInput
): RecommendationReason => {
    const { destination, type } = input.score;

    const destinationQualifies = destination >= DESTINATION_REASON_MIN_POINTS;
    const typeQualifies = type > TYPE_REASON_MIN_POINTS;

    if (destinationQualifies && typeQualifies) {
        const destinationShare = destination / DESTINATION_MAX_POINTS;
        const typeShare = type / TYPE_MAX_POINTS;
        // Tie favors DESTINATION (spec §5.4 weights it highest).
        return typeShare > destinationShare ? 'TYPE' : 'DESTINATION';
    }

    if (destinationQualifies) {
        return 'DESTINATION';
    }

    if (typeQualifies) {
        return 'TYPE';
    }

    return 'OTHER';
};
