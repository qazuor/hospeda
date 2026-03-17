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

// Add-on schemas (consolidated in @repo/schemas)
export {
    AddonBillingTypeSchema,
    AddonResponseSchema,
    AddonTargetCategorySchema,
    CancelAddonSchema,
    ListAddonsQuerySchema,
    PurchaseAddonResponseSchema,
    PurchaseAddonSchema,
    UserAddonResponseSchema
} from '@repo/schemas';

export type {
    AddonResponse,
    CancelAddon,
    ListAddonsQuery,
    PurchaseAddon,
    PurchaseAddonResponse,
    UserAddonResponse
} from '@repo/schemas';

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

// Customer add-on purchase schemas (consolidated in @repo/schemas)
export {
    ADDON_PURCHASE_RESPONSE_STATUSES,
    ADDON_PURCHASE_STATUSES,
    CustomerAddonActionResponseSchema,
    CustomerAddonIdParamSchema,
    CustomerAddonResponseSchema,
    CustomerAddonsListResponseSchema,
    EntitlementAdjustmentSchema,
    LimitAdjustmentSchema,
    ListCustomerAddonsQuerySchema
} from '@repo/schemas';

export type {
    CustomerAddonActionResponse,
    CustomerAddonIdParam,
    CustomerAddonResponse,
    CustomerAddonsListResponse,
    ListCustomerAddonsQuery
} from '@repo/schemas';

// Subscription events schemas (routing-specific only; response schemas live in @repo/schemas)
export {
    ListSubscriptionEventsQuerySchema,
    SubscriptionEventsParamSchema
} from './subscription-events.schema';

export type {
    ListSubscriptionEventsQuery,
    SubscriptionEventsParam
} from './subscription-events.schema';

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
