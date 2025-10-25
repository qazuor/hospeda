/**
 * Benefit Listing Schema Exports
 *
 * This module exports all benefit listing-related schemas for the benefits platform.
 * Includes main listing schema, CRUD operations, queries, HTTP coercion,
 * and comprehensive benefit management functionality.
 */

// Main benefit listing schema
export {
    BenefitListingSchema,
    BenefitListingWithPartnerSchema,
    PublicBenefitListingSchema,
    type BenefitListing,
    type BenefitListingWithPartner,
    type PublicBenefitListing
} from './benefitListing.schema.js';

// CRUD operation schemas
export {
    CreateBenefitListingSchema,
    UpdateBenefitConfigurationSchema,
    UpdateBenefitListingSchema,
    UpdateBenefitListingStatusSchema,
    UpdateBenefitListingTrialSchema,
    type CreateBenefitListing,
    type UpdateBenefitConfiguration,
    type UpdateBenefitListing,
    type UpdateBenefitListingStatus,
    type UpdateBenefitListingTrial
} from './benefitListing.crud.schema.js';

// Query and search schemas
export {
    BenefitListingAnalyticsSchema,
    BenefitUsageAnalyticsSchema,
    BulkBenefitListingOperationSchema,
    SearchBenefitListingsSchema,
    type BenefitListingAnalytics,
    type BenefitUsageAnalytics,
    type BulkBenefitListingOperation,
    type SearchBenefitListings
} from './benefitListing.query.schema.js';

// HTTP coercion schemas
export {
    HttpCreateBenefitListingSchema,
    HttpSearchBenefitListingsSchema,
    HttpUpdateBenefitListingSchema,
    type HttpCreateBenefitListing,
    type HttpSearchBenefitListings,
    type HttpUpdateBenefitListing
} from './benefitListing.http.schema.js';
