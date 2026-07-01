/**
 * Recommendation feed exports (SPEC-284).
 *
 * @module services/recommendation
 */
export {
    buildRecommendationProfile,
    FAVORITE_SIGNAL_WEIGHT,
    RECENTLY_VIEWED_SIGNAL_WEIGHT,
    SEARCH_HISTORY_SIGNAL_WEIGHT
} from './recommendation.profile';
export type { BuildRecommendationProfileInput } from './recommendation.profile';

export {
    DESTINATION_CITY_MATCH_POINTS,
    DESTINATION_COUNTRY_MATCH_POINTS,
    DESTINATION_PROVINCE_MATCH_POINTS,
    DESTINATION_REGION_MATCH_POINTS,
    scoreAndRankCandidates,
    scoreCandidateAccommodation
} from './recommendation.scorer';
export type {
    DestinationPathLookup,
    ScoreAndRankCandidatesInput,
    ScoreCandidateAccommodationInput
} from './recommendation.scorer';

export { RecommendationService } from './recommendation.service';
