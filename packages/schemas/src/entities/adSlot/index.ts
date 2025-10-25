/**
 * AdSlot Entity Schemas
 *
 * Comprehensive schema package for advertising slot management including
 * slot configuration, reservations, pricing, targeting, and analytics.
 *
 * @module AdSlotSchemas
 */

// Core ad slot schema
export { AdSlotSchema } from './adSlot.schema.js';
export type { AdSlot } from './adSlot.schema.js';

// CRUD operations schemas
export {
    BulkUpdateAdSlotsSchema,
    CloneAdSlotSchema,
    CreateAdSlotSchema,
    UpdateAdSlotAvailabilitySchema,
    UpdateAdSlotPerformanceSchema,
    UpdateAdSlotPricingSchema,
    UpdateAdSlotSchema,
    UpdateAdSlotStatusSchema
} from './adSlot.crud.schema.js';

export type {
    BulkUpdateAdSlots,
    CloneAdSlot,
    CreateAdSlot,
    UpdateAdSlot,
    UpdateAdSlotAvailability,
    UpdateAdSlotPerformance,
    UpdateAdSlotPricing,
    UpdateAdSlotStatus
} from './adSlot.crud.schema.js';

// Query and search schemas
export {
    AdSlotAvailabilityQuerySchema,
    AdSlotPaginationSchema,
    AdSlotPerformanceQuerySchema,
    AdSlotQuerySchema,
    AdSlotRecommendationQuerySchema,
    AdSlotReservationAnalyticsSchema,
    AdSlotSearchSchema,
    AdSlotSortingSchema
} from './adSlot.query.schema.js';

export type {
    AdSlotAvailabilityQuery,
    AdSlotPagination,
    AdSlotPerformanceQuery,
    AdSlotQuery,
    AdSlotRecommendationQuery,
    AdSlotReservationAnalytics,
    AdSlotSearch,
    AdSlotSorting
} from './adSlot.query.schema.js';

// HTTP parameter schemas
export {
    AdSlotAvailabilityParamsSchema,
    AdSlotIdParamSchema,
    AdSlotListParamsSchema,
    AdSlotPerformanceParamsSchema
} from './adSlot.http.schema.js';

export type {
    AdSlotAvailabilityParams,
    AdSlotIdParam,
    AdSlotListParams,
    AdSlotPerformanceParams
} from './adSlot.http.schema.js';

// Relationship schemas
export {
    AdSlotMediaAssetsSchema,
    AdSlotReservationSchema,
    AdSlotTargetingAnalyticsSchema,
    AdSlotWithCampaignSchema,
    AdSlotWithRelationsSchema
} from './adSlot.relations.schema.js';

export type {
    AdSlotMediaAssets,
    AdSlotReservation,
    AdSlotTargetingAnalytics,
    AdSlotWithCampaign,
    AdSlotWithRelations
} from './adSlot.relations.schema.js';
