import { z } from 'zod';
import { DestinationSchema } from './destination.schema.js';

/**
 * Response schemas for Destination entity (API-facing).
 * Aligns with the structure of `accommodation.responses.schema.ts`.
 */

/**
 * Minimal list item payload for destination list responses.
 */
export const DestinationListItemSchema = DestinationSchema.pick({
    id: true,
    slug: true,
    name: true,
    isFeatured: true,
    visibility: true,
    averageRating: true,
    reviewsCount: true,
    accommodationsCount: true
}).extend({
    // Optional lightweight media/location details for cards and SERPs
    featuredImage: z.string().url().optional(),
    city: z.string().optional(),
    country: z.string().optional()
});
export type DestinationListItem = z.infer<typeof DestinationListItemSchema>;

/**
 * Detailed destination response (no lazy relations to keep OpenAPI simple).
 */
export const DestinationDetailSchema = DestinationSchema;
export type DestinationDetail = z.infer<typeof DestinationDetailSchema>;

/**
 * Public-facing summary schema for destination cards.
 */
export const DestinationSummarySchema = DestinationSchema.pick({
    id: true,
    slug: true,
    name: true,
    isFeatured: true
}).extend({
    averageRating: z.number().min(0).max(5).default(0),
    reviewsCount: z.number().int().min(0).default(0),
    accommodationsCount: z.number().int().min(0).default(0),
    location: z
        .object({
            country: z.string().optional(),
            state: z.string().optional(),
            city: z.string().optional()
        })
        .optional(),
    featuredImage: z.string().url().optional()
});
export type DestinationSummary = z.infer<typeof DestinationSummarySchema>;

/**
 * Stats schema for destination.
 */
export const DestinationStatsSchema = z.object({
    accommodationsCount: z.number().int().min(0),
    reviewsCount: z.number().int().min(0),
    averageRating: z.number().min(0).max(5)
});
export type DestinationStatsResponse = z.infer<typeof DestinationStatsSchema>;
