import { z } from 'zod';
import { AccommodationListingSchema } from './accommodationListing.schema.js';

/**
 * AccommodationListing Relations Schemas
 *
 * This file contains schemas for accommodation listings with related entities:
 * - AccommodationListing with Accommodation
 * - AccommodationListing with ListingPlan
 * - AccommodationListing with Client
 * - Full relations with all related entities
 */

// ============================================================================
// BASIC RELATION SCHEMAS
// ============================================================================

/**
 * Minimal Accommodation info for listing relations
 */
export const AccommodationRelationSchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    summary: z.string(),
    type: z.string(),
    isFeatured: z.boolean(),
    destinationId: z.string().uuid(),
    ownerId: z.string().uuid()
});

export type AccommodationRelation = z.infer<typeof AccommodationRelationSchema>;

/**
 * Minimal Client info for listing relations
 */
export const ClientRelationSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    billingEmail: z.string().email()
});

export type ClientRelation = z.infer<typeof ClientRelationSchema>;

/**
 * Minimal AccommodationListingPlan info for listing relations
 */
export const AccommodationListingPlanRelationSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    limits: z.record(z.string(), z.unknown()).optional()
});

export type AccommodationListingPlanRelation = z.infer<
    typeof AccommodationListingPlanRelationSchema
>;

// ============================================================================
// COMPOSED RELATION SCHEMAS
// ============================================================================

/**
 * AccommodationListing with Accommodation relation
 */
export const AccommodationListingWithAccommodationSchema = AccommodationListingSchema.extend({
    accommodation: AccommodationRelationSchema
});

export type AccommodationListingWithAccommodation = z.infer<
    typeof AccommodationListingWithAccommodationSchema
>;

/**
 * AccommodationListing with ListingPlan relation
 */
export const AccommodationListingWithPlanSchema = AccommodationListingSchema.extend({
    listingPlan: AccommodationListingPlanRelationSchema
});

export type AccommodationListingWithPlan = z.infer<typeof AccommodationListingWithPlanSchema>;

/**
 * AccommodationListing with Client relation
 */
export const AccommodationListingWithClientSchema = AccommodationListingSchema.extend({
    client: ClientRelationSchema
});

export type AccommodationListingWithClient = z.infer<typeof AccommodationListingWithClientSchema>;

/**
 * AccommodationListing with Accommodation and Plan relations
 */
export const AccommodationListingWithAccommodationAndPlanSchema = AccommodationListingSchema.extend(
    {
        accommodation: AccommodationRelationSchema,
        listingPlan: AccommodationListingPlanRelationSchema
    }
);

export type AccommodationListingWithAccommodationAndPlan = z.infer<
    typeof AccommodationListingWithAccommodationAndPlanSchema
>;

/**
 * AccommodationListing with all main relations
 */
export const AccommodationListingWithAllRelationsSchema = AccommodationListingSchema.extend({
    accommodation: AccommodationRelationSchema,
    listingPlan: AccommodationListingPlanRelationSchema,
    client: ClientRelationSchema
});

export type AccommodationListingWithAllRelations = z.infer<
    typeof AccommodationListingWithAllRelationsSchema
>;

// ============================================================================
// LIST RESPONSES WITH RELATIONS
// ============================================================================

/**
 * List response with accommodation relations
 */
export const AccommodationListingListWithAccommodationResponseSchema = z.object({
    items: z.array(AccommodationListingWithAccommodationSchema),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
    totalCount: z.number().int().optional()
});

export type AccommodationListingListWithAccommodationResponse = z.infer<
    typeof AccommodationListingListWithAccommodationResponseSchema
>;

/**
 * List response with plan relations
 */
export const AccommodationListingListWithPlanResponseSchema = z.object({
    items: z.array(AccommodationListingWithPlanSchema),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
    totalCount: z.number().int().optional()
});

export type AccommodationListingListWithPlanResponse = z.infer<
    typeof AccommodationListingListWithPlanResponseSchema
>;

/**
 * List response with all relations
 */
export const AccommodationListingListWithAllRelationsResponseSchema = z.object({
    items: z.array(AccommodationListingWithAllRelationsSchema),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
    totalCount: z.number().int().optional()
});

export type AccommodationListingListWithAllRelationsResponse = z.infer<
    typeof AccommodationListingListWithAllRelationsResponseSchema
>;

// ============================================================================
// QUERY SCHEMAS WITH RELATIONS
// ============================================================================

/**
 * Query schema to include related entities
 */
export const AccommodationListingWithRelationsQuerySchema = z.object({
    includeAccommodation: z.boolean().default(false),
    includeListingPlan: z.boolean().default(false),
    includeClient: z.boolean().default(false)
});

export type AccommodationListingWithRelationsQuery = z.infer<
    typeof AccommodationListingWithRelationsQuerySchema
>;

/**
 * Extended query schema combining filters with relations
 */
export const AccommodationListingExtendedQuerySchema = z.object({
    // Base query filters would be imported here
    q: z.string().optional(),
    status: z.string().optional(),
    clientId: z.string().uuid().optional(),
    accommodationId: z.string().uuid().optional(),

    // Pagination
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(10),

    // Relations
    ...AccommodationListingWithRelationsQuerySchema.shape
});

export type AccommodationListingExtendedQuery = z.infer<
    typeof AccommodationListingExtendedQuerySchema
>;
