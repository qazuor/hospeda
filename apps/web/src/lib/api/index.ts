/**
 * Public API client - re-exports all API utilities and endpoints.
 */
export { apiClient, fetchAllPages } from './client';
export {
    accommodationsApi,
    contactApi,
    destinationsApi,
    eventsApi,
    postsApi
} from './endpoints';
export {
    authApi,
    exchangeRatesApi,
    plansApi,
    tagsApi,
    userApi,
    userBookmarksApi
} from './endpoints-protected';
export type { ExchangeRateItem, SubscriptionData } from './endpoints-protected';
export {
    toAccommodationCardProps,
    toAccommodationDetailedProps,
    toDestinationCardProps,
    toEventCardProps,
    toPostCardProps
} from './transforms';
export type {
    AccommodationCardData,
    AccommodationDetailedCardData,
    BlogPostCardData,
    CardAmenityFeature,
    CardLocation,
    CardPrice,
    DestinationCardData,
    EventCardData,
    EventLocation
} from './transforms';
export type {
    ApiError,
    ApiResult,
    ApiSuccessResponse,
    ListParams,
    PaginatedResponse,
    PaginationMeta
} from './types';
