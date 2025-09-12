import { z } from 'zod';
import { PostIdSchema } from '../../common/id.schema.js';
import {
    WithAccommodationIdParamsSchema,
    WithDateRangeParamsSchema,
    WithDestinationIdParamsSchema,
    WithEventIdParamsSchema,
    WithVisibilityParamsSchema
} from '../../common/params.schema.js';
import { PostCategoryEnumSchema } from '../../enums/index.js';

/**
 * Post Filters Schemas
 *
 * This file contains schemas for filtering and querying posts:
 * - Service-specific query parameters
 * - Specialized filter combinations
 * - Input schemas for specific post endpoints
 */

// ============================================================================
// BASE QUERY SCHEMAS
// ============================================================================

/**
 * Base schema for post queries with common filters
 * Used as foundation for specific query types
 */
export const BasePostQueryParamsSchema =
    WithVisibilityParamsSchema.merge(WithDateRangeParamsSchema);

// ============================================================================
// SPECIFIC QUERY INPUT SCHEMAS
// ============================================================================

/**
 * Schema for getting news posts
 * Filters posts where isNews = true
 */
export const GetPostNewsInputSchema = BasePostQueryParamsSchema.strict();

/**
 * Schema for getting featured posts
 * Filters posts where isFeatured = true
 */
export const GetPostFeaturedInputSchema = BasePostQueryParamsSchema.strict();

/**
 * Schema for getting posts by category
 * Requires category and supports common filters
 */
export const GetPostByCategoryInputSchema = BasePostQueryParamsSchema.extend({
    category: PostCategoryEnumSchema
}).strict();

/**
 * Schema for getting posts by related accommodation
 * Requires accommodationId and supports common filters
 */
export const GetPostByRelatedAccommodationInputSchema = BasePostQueryParamsSchema.extend({
    accommodationId: WithAccommodationIdParamsSchema.shape.accommodationId
}).strict();

/**
 * Schema for getting posts by related destination
 * Requires destinationId and supports common filters
 */
export const GetPostByRelatedDestinationInputSchema = BasePostQueryParamsSchema.extend({
    destinationId: WithDestinationIdParamsSchema.shape.destinationId
}).strict();

/**
 * Schema for getting posts by related event
 * Requires eventId and supports common filters
 */
export const GetPostByRelatedEventInputSchema = BasePostQueryParamsSchema.extend({
    eventId: WithEventIdParamsSchema.shape.eventId
}).strict();

// ============================================================================
// SUMMARY/STATS INPUT SCHEMAS
// ============================================================================

/**
 * Schema for getting post summary
 * Accepts either id or slug (one required)
 */
export const GetPostSummaryInputSchema = z
    .object({
        id: PostIdSchema.optional(),
        slug: z.string().min(1).optional()
    })
    .strict()
    .refine((data) => data.id || data.slug, {
        message: 'Either id or slug must be provided',
        path: ['id']
    });

/**
 * Schema for getting post stats
 * Accepts either id or slug (one required)
 */
export const GetPostStatsInputSchema = z
    .object({
        id: PostIdSchema.optional(),
        slug: z.string().min(1).optional()
    })
    .strict()
    .refine((data) => data.id || data.slug, {
        message: 'Either id or slug must be provided',
        path: ['id']
    });

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type BasePostQueryParams = z.infer<typeof BasePostQueryParamsSchema>;
export type GetPostNewsInput = z.infer<typeof GetPostNewsInputSchema>;
export type GetPostFeaturedInput = z.infer<typeof GetPostFeaturedInputSchema>;
export type GetPostByCategoryInput = z.infer<typeof GetPostByCategoryInputSchema>;
export type GetPostByRelatedAccommodationInput = z.infer<
    typeof GetPostByRelatedAccommodationInputSchema
>;
export type GetPostByRelatedDestinationInput = z.infer<
    typeof GetPostByRelatedDestinationInputSchema
>;
export type GetPostByRelatedEventInput = z.infer<typeof GetPostByRelatedEventInputSchema>;
export type GetPostSummaryInput = z.infer<typeof GetPostSummaryInputSchema>;
export type GetPostStatsInput = z.infer<typeof GetPostStatsInputSchema>;
