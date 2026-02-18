/**
 * Public API client - re-exports all API utilities and endpoints.
 */
export { apiClient, fetchAllPages } from './client';
export {
    accommodationsApi,
    authApi,
    contactApi,
    destinationsApi,
    eventsApi,
    postsApi
} from './endpoints';
export type {
    ApiError,
    ApiResult,
    ApiSuccessResponse,
    ListParams,
    PaginatedResponse,
    PaginationMeta
} from './types';
