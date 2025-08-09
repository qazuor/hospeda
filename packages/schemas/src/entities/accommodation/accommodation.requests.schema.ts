import { VisibilityEnum } from '@repo/types';
import { z } from 'zod';
import { AccommodationIdSchema, DestinationIdSchema } from '../../common/id.schema.js';
import { ContactInfoSchema, LocationSchema, SocialNetworkSchema } from '../../common/index.js';
import { SortDirectionSchema } from '../../common/search.schemas.js';
import { AccommodationTypeEnumSchema, VisibilityEnumSchema } from '../../enums/index.js';
import { AccommodationPriceSchema } from './accommodation.base.schema.js';

/**
 * Schema for creating a new accommodation
 * Used in: POST /accommodations
 *
 * Contains required fields for accommodation creation.
 * Excludes computed fields like averageRating, reviewsCount.
 */
export const AccommodationCreateSchema = z.object({
    // Required basic information
    name: z
        .string({
            message: 'zodError.accommodation.name.required'
        })
        .min(3, { message: 'zodError.accommodation.name.min' })
        .max(100, { message: 'zodError.accommodation.name.max' }),

    summary: z
        .string({
            message: 'zodError.accommodation.summary.required'
        })
        .min(10, { message: 'zodError.accommodation.summary.min' })
        .max(300, { message: 'zodError.accommodation.summary.max' }),

    description: z
        .string({
            message: 'zodError.accommodation.description.required'
        })
        .min(30, { message: 'zodError.accommodation.description.min' })
        .max(2000, { message: 'zodError.accommodation.description.max' }),

    type: AccommodationTypeEnumSchema,

    // Required relations
    destinationId: DestinationIdSchema,

    // Optional but commonly provided
    visibility: VisibilityEnumSchema.default(VisibilityEnum.PRIVATE),
    isFeatured: z.boolean().default(false),

    // Optional detailed information
    location: LocationSchema.optional(),
    contactInfo: ContactInfoSchema.optional(),
    socialNetworks: SocialNetworkSchema.optional(),
    price: AccommodationPriceSchema.optional(),

    // SEO (optional on creation)
    seo: z
        .object({
            title: z.string().min(30).max(60).optional(),
            description: z.string().min(70).max(160).optional(),
            keywords: z.array(z.string()).optional()
        })
        .optional(),

    // Tags as simple string array (to avoid circular deps)
    tags: z
        .array(z.string().min(1))
        .max(10, { message: 'zodError.accommodation.tags.maxItems' })
        .optional(),

    // Feature and amenity IDs (not full objects)
    featureIds: z.array(z.string().uuid()).optional(),
    amenityIds: z.array(z.string().uuid()).optional()
});

/**
 * Schema for updating an accommodation
 * Used in: PUT /accommodations/:id
 *
 * Most fields are optional for partial updates.
 * Excludes immutable fields like id, createdAt, createdById.
 */
export const AccommodationUpdateSchema = AccommodationCreateSchema.partial().extend({
    // These fields cannot be updated via API
    // id: never, - inherited as optional from partial()
    // createdAt: never,
    // createdById: never,

    // Slug can be updated but with special validation
    slug: z
        .string()
        .min(3, { message: 'zodError.accommodation.slug.min' })
        .max(50, { message: 'zodError.accommodation.slug.max' })
        .regex(/^[a-z0-9-]+$/, { message: 'zodError.accommodation.slug.pattern' })
        .optional()
});

/**
 * Schema for bulk update operations
 * Used in: PATCH /accommodations/bulk
 */
export const AccommodationBulkUpdateSchema = z.object({
    ids: z
        .array(AccommodationIdSchema)
        .min(1, { message: 'zodError.accommodation.bulk.minItems' })
        .max(100, { message: 'zodError.accommodation.bulk.maxItems' }),

    updates: z.object({
        visibility: VisibilityEnumSchema.optional(),
        isFeatured: z.boolean().optional(),
        tags: z.array(z.string()).optional()
        // Add other bulk-updatable fields as needed
    })
});

/**
 * Schema for accommodation filtering
 * Used in: GET /accommodations query parameters
 */
export const AccommodationFilterSchema = z.object({
    // Location filters
    city: z.string().optional(),
    country: z.string().optional(),
    destinationId: DestinationIdSchema.optional(),

    // Type and status filters
    type: AccommodationTypeEnumSchema.optional(),
    visibility: VisibilityEnumSchema.optional(),
    isFeatured: z.boolean().optional(),

    // Rating filters
    minRating: z.number().min(0).max(5).optional(),
    maxRating: z.number().min(0).max(5).optional(),

    // Price filters
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    currency: z.string().length(3).optional(),

    // Tags filter (string array to avoid circular deps)
    tags: z.array(z.string()).optional(),

    // Text search
    q: z.string().min(1).max(100).optional(),

    // Pagination
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),

    // Sorting
    sortBy: z.enum(['name', 'rating', 'price', 'createdAt', 'featured']).default('createdAt'),
    sortOrder: SortDirectionSchema.default('DESC')
});

/**
 * Schema for accommodation search (with more flexible text search)
 * Used in: GET /accommodations/search
 */
export const AccommodationSearchSchema = AccommodationFilterSchema.extend({
    // Enhanced search capabilities
    searchIn: z
        .array(z.enum(['name', 'description', 'summary', 'tags']))
        .default(['name', 'description'])
});

/**
 * Type exports for TypeScript
 */
export type AccommodationCreateRequest = z.infer<typeof AccommodationCreateSchema>;
export type AccommodationUpdateRequest = z.infer<typeof AccommodationUpdateSchema>;
export type AccommodationBulkUpdateRequest = z.infer<typeof AccommodationBulkUpdateSchema>;
export type AccommodationFilterRequest = z.infer<typeof AccommodationFilterSchema>;
export type AccommodationSearchRequest = z.infer<typeof AccommodationSearchSchema>;
