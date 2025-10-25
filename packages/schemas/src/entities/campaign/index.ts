/**
 * Campaign Schema Exports
 *
 * This module exports all campaign-related schemas for the marketing platform.
 * Includes main campaign schema, CRUD operations, queries, HTTP coercion,
 * and relationship schemas with comprehensive budget and performance tracking.
 */

// Main campaign schema
export {
    CampaignSchema,
    type Campaign
} from './campaign.schema.js';

// CRUD operation schemas
export {
    CreateCampaignSchema,
    UpdateCampaignBudgetSchema,
    UpdateCampaignPerformanceSchema,
    UpdateCampaignSchema,
    UpdateCampaignStatusSchema,
    type CreateCampaign,
    type UpdateCampaign,
    type UpdateCampaignBudget,
    type UpdateCampaignPerformance,
    type UpdateCampaignStatus
} from './campaign.crud.schema.js';

// Query and search schemas
export {
    BulkCampaignOperationSchema,
    CampaignAnalyticsSchema,
    SearchCampaignsSchema,
    type BulkCampaignOperation,
    type CampaignAnalytics,
    type SearchCampaigns
} from './campaign.query.schema.js';

// HTTP coercion schemas
export {
    HttpBulkCampaignOperationSchema,
    HttpCampaignAnalyticsSchema,
    HttpCreateCampaignSchema,
    HttpSearchCampaignsSchema,
    HttpUpdateCampaignSchema,
    type HttpBulkCampaignOperation,
    type HttpCampaignAnalytics,
    type HttpCreateCampaign,
    type HttpSearchCampaigns,
    type HttpUpdateCampaign
} from './campaign.http.schema.js';

// Relationship schemas
export {
    CampaignWithAccommodationsSchema,
    CampaignWithAllRelationsSchema,
    CampaignWithAnalyticsSchema,
    CampaignWithBudgetTrackingSchema,
    CampaignWithCreatorSchema,
    CampaignWithNotificationsSchema,
    CampaignWithPerformanceSchema,
    type CampaignWithAccommodations,
    type CampaignWithAllRelations,
    type CampaignWithAnalytics,
    type CampaignWithBudgetTracking,
    type CampaignWithCreator,
    type CampaignWithNotifications,
    type CampaignWithPerformance
} from './campaign.relations.schema.js';
