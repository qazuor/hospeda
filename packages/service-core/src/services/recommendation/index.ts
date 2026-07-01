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
