import { z } from 'zod';
import { DestinationSchema } from './destination.schema.js';

/**
 * Service-layer schemas for Destination entity
 * Centralized in @repo/schemas to be the single source of truth.
 */

/**
 * Schema for creating a new Destination at the service layer.
 * Omits server-managed fields and relations. Allows optional slug and relation id arrays.
 */
export const CreateDestinationServiceSchema = DestinationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    reviews: true,
    rating: true,
    accommodationsCount: true,
    averageRating: true
})
    .extend({
        slug: z.string().optional(),
        tagIds: z.array(z.string()).optional(),
        attractionIds: z.array(z.string()).optional()
    })
    .strict();

/**
 * Schema for updating an existing Destination at the service layer.
 * All fields optional to support partial updates.
 */
export const UpdateDestinationServiceSchema = CreateDestinationServiceSchema.partial();

/**
 * Input schema for fetching accommodations by destination.
 */
export const GetAccommodationsInputSchema = z
    .object({
        destinationId: z.string().min(1)
    })
    .strict();
export type GetAccommodationsInput = z.infer<typeof GetAccommodationsInputSchema>;

/**
 * Input schema for computing destination stats.
 */
export const GetStatsInputSchema = z
    .object({
        destinationId: z.string().min(1)
    })
    .strict();
export type GetStatsInput = z.infer<typeof GetStatsInputSchema>;

/**
 * Input schema for retrieving destination summary.
 */
export const GetSummaryInputSchema = z
    .object({
        destinationId: z.string().min(1)
    })
    .strict();
export type GetSummaryInput = z.infer<typeof GetSummaryInputSchema>;

/**
 * Domain stats type for Destination.
 */
export type DestinationStats = {
    accommodationsCount: number;
    reviewsCount: number;
    averageRating: number;
};

/**
 * Public summary DTO for Destination.
 */
export type DestinationSummaryType = {
    id: string;
    slug: string;
    name: string;
    country: string;
    media: import('@repo/types').DestinationType['media'];
    location: import('@repo/types').DestinationType['location'];
    isFeatured: boolean;
    averageRating: number;
    reviewsCount: number;
    accommodationsCount: number;
};
