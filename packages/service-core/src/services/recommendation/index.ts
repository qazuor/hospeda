/**
 * Recommendation feed exports (SPEC-284).
 *
 * @module services/recommendation
 */

export type { BuildRecommendationProfileInput } from './recommendation.profile';
export {
    buildRecommendationProfile,
    FAVORITE_SIGNAL_WEIGHT,
    RECENTLY_VIEWED_SIGNAL_WEIGHT,
    SEARCH_HISTORY_SIGNAL_WEIGHT
} from './recommendation.profile';
export type { AttributeRecommendationReasonInput } from './recommendation.reason';
export {
    attributeRecommendationReason,
    DESTINATION_REASON_MIN_POINTS,
    TYPE_REASON_MIN_POINTS
} from './recommendation.reason';
export type {
    DestinationPathLookup,
    ScoreAndRankCandidatesInput,
    ScoreCandidateAccommodationInput
} from './recommendation.scorer';
export {
    DESTINATION_CITY_MATCH_POINTS,
    DESTINATION_COUNTRY_MATCH_POINTS,
    DESTINATION_MAX_POINTS,
    DESTINATION_PROVINCE_MATCH_POINTS,
    DESTINATION_REGION_MATCH_POINTS,
    scoreAndRankCandidates,
    scoreCandidateAccommodation,
    TYPE_MAX_POINTS
} from './recommendation.scorer';

export { RecommendationService } from './recommendation.service';
