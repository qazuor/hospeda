import { z } from 'zod';
import { CoordinatesSchema } from '../common.schema';
import { VisibilityEnumSchema } from '../enums.schema';

/**
 * Location schema for a destination.
 */
export const DestinationLocationSchema = z.object({
    department: z.string(),
    state: z.string(),
    zipCode: z.string().optional(),
    country: z.string(),
    coordinates: CoordinatesSchema
});

/**
 * Rating schema for destinations (extended).
 */
export const DestinationRatingSchema = z.object({
    landscape: z.number(),
    attractions: z.number(),
    accessibility: z.number(),
    safety: z.number(),
    cleanliness: z.number(),
    hospitality: z.number(),
    culturalOffer: z.number(),
    gastronomy: z.number(),
    affordability: z.number(),
    nightlife: z.number(),
    infrastructure: z.number(),
    environmentalCare: z.number(),
    wifiAvailability: z.number(),
    shopping: z.number(),
    beaches: z.number(),
    greenSpaces: z.number(),
    localEvents: z.number(),
    weatherSatisfaction: z.number()
});

/**
 * Review schema for destinations.
 */
export const DestinationReviewSchema = z.object({
    author: z.string().uuid(),
    title: z.string(),
    content: z.string(),
    rating: DestinationRatingSchema
});

/**
 * Single attraction inside a destination.
 */
export const DestinationAttractionsSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    icon: z.string(),
    state: z.string(),
    createdAt: z.string(),
    createdBy: z.any(),
    updatedAt: z.string(),
    updatedBy: z.any(),
    deletedAt: z.string().optional(),
    deletedBy: z.any().optional()
});

/**
 * Full destination schema.
 */
export const DestinationSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    longName: z.string(),
    slug: z.string(),
    summary: z.string(),
    description: z.string(),
    media: z.any(), // you can replace with MediaSchema if defined
    tags: z.array(z.string()).optional(),
    isFeatured: z.boolean().optional(),
    visibility: VisibilityEnumSchema,
    seo: z.any().optional(),
    adminInfo: z.any().optional(),
    rating: DestinationRatingSchema.optional(),
    reviews: z.array(DestinationReviewSchema).optional(),
    location: DestinationLocationSchema,
    attractions: z.array(DestinationAttractionsSchema),
    state: z.string(),
    createdAt: z.string(),
    createdBy: z.any(),
    updatedAt: z.string(),
    updatedBy: z.any(),
    deletedAt: z.string().optional(),
    deletedBy: z.any().optional()
});
