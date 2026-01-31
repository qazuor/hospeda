/**
 * Base schemas exports
 */

// Base schemas
export {
    commonFieldSchemas,
    dateRangeQuerySchema,
    geolocationQuerySchema,
    idParamSchema,
    languageQuerySchema,
    paginationQuerySchema,
    searchQuerySchema,
    searchWithPaginationSchema
} from './base-schemas';

// Response schemas (Zod schemas for OpenAPI)
// NOTE: For runtime response helpers, import from '../utils/response-helpers'
export {
    apiErrorCodes,
    errorResponseSchema,
    httpStatusCodes,
    paginatedListResponseSchema,
    paginationMetadataSchema,
    successResponseSchema
} from './response-schemas';

export type { ApiResponse, PaginationData } from './response-schemas';

// Add-on schemas
export {
    AddonBillingTypeSchema,
    AddonResponseSchema,
    AddonTargetCategorySchema,
    CancelAddonSchema,
    ListAddonsQuerySchema,
    PurchaseAddonResponseSchema,
    PurchaseAddonSchema,
    UserAddonResponseSchema
} from './addon.schema';

export type {
    AddonResponse,
    CancelAddon,
    ListAddonsQuery,
    PurchaseAddon,
    PurchaseAddonResponse,
    UserAddonResponse
} from './addon.schema';

// Notification schemas
export {
    ListNotificationLogsQuerySchema,
    NotificationLogResponseSchema,
    NotificationLogsListResponseSchema
} from './notification.schema';

export type {
    ListNotificationLogsQuery,
    NotificationLogResponse,
    NotificationLogsListResponse
} from './notification.schema';

// Webhook schemas
export {
    DeadLetterEntryResponseSchema,
    DeadLetterQueueListResponseSchema,
    DeadLetterRetryResponseSchema,
    ListDeadLetterQueueQuerySchema,
    ListWebhookEventsQuerySchema,
    WebhookEventResponseSchema,
    WebhookEventsListResponseSchema
} from './webhook.schema';

export type {
    DeadLetterEntryResponse,
    DeadLetterQueueListResponse,
    DeadLetterRetryResponse,
    ListDeadLetterQueueQuery,
    ListWebhookEventsQuery,
    WebhookEventResponse,
    WebhookEventsListResponse
} from './webhook.schema';
