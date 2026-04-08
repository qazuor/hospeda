/**
 * Public API client for web2 - re-exports all API utilities, endpoints, and transforms.
 *
 * Three tiers of endpoints:
 * - Public (`endpoints.ts`): no auth required, safe to call from any page
 * - Protected (`endpoints-protected.ts`): require an authenticated session
 * - Transforms (`transforms.ts`): convert raw API responses to component-ready props
 */
export { apiClient, fetchAllPages } from './client';

// --- Public endpoints ---

export {
    accommodationsApi,
    contactApi,
    destinationsApi,
    eventsApi,
    postsApi,
    testimonialsApi
} from './endpoints';

// --- Protected endpoints ---

export {
    authApi,
    billingApi,
    exchangeRatesApi,
    plansApi,
    reviewsApi,
    tagsApi,
    userApi,
    userBookmarksApi
} from './endpoints-protected';

// --- Protected endpoint types ---

export type {
    AccommodationReviewRating,
    CreateAccommodationReviewBody,
    ExchangeRateConfig,
    ExchangeRateItem,
    InvoiceItem,
    PaymentItem,
    PlanItem,
    SubscriptionData,
    TagPublicResponse,
    UsageSummary,
    UserAddon
} from './endpoints-protected';

// --- Transform functions ---

export {
    toAccommodationCardProps,
    toAccommodationDetailedProps,
    toDestinationCardProps,
    toEventCardProps,
    toPostCardProps,
    toTestimonialCardProps
} from './transforms';

// --- Transform types ---

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

// --- Core types ---

export type {
    ApiError,
    ApiErrorResponse,
    ApiResult,
    ApiSuccessResponse,
    ListParams,
    PaginatedResponse,
    PaginationMeta
} from './types';
