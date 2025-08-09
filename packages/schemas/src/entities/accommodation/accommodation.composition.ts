import { z } from 'zod';
import {
    createCreateSchema,
    createDetailSchema,
    createListItemSchema,
    createUpdateSchema
} from '../../common/schema-utils.js';
import {
    AccommodationTypeEnumSchema,
    LifecycleStatusEnumSchema,
    ModerationStatusEnumSchema,
    VisibilityEnumSchema
} from '../../enums/index.js';
import {
    AccommodationAmenitiesSchema,
    AccommodationCoreSchema,
    AccommodationExtraInfoSchema,
    AccommodationFaqsSchema,
    AccommodationFeaturesSchema,
    AccommodationIaDataSchema,
    AccommodationPriceSchema,
    AccommodationReviewsSchema,
    AccommodationScheduleSchema
} from './accommodation.base.js';

/**
 * Composition Schemas for Accommodation Entity
 *
 * These schemas are built by combining base schemas using
 * pick, omit, extend, and merge operations to create
 * specific schemas for different use cases.
 */

/**
 * Schema for accommodation list items (minimal data for lists)
 * Used in: GET /accommodations
 */
export const AccommodationListItemSchema = createListItemSchema(AccommodationCoreSchema).extend({
    // Add minimal media info for list display
    media: z
        .object({
            featuredImage: z
                .object({
                    url: z.string().url(),
                    caption: z.string().optional()
                })
                .optional()
        })
        .optional(),

    // Add minimal location info for list display
    location: z
        .object({
            city: z.string().optional(),
            country: z.string().optional()
        })
        .optional(),

    // Add minimal price info for list display
    price: z
        .object({
            amount: z.number().optional(),
            currency: z.string().optional()
        })
        .optional()
});

/**
 * Schema for accommodation detail view (comprehensive data)
 * Used in: GET /accommodations/:id, GET /accommodations/slug/:slug
 */
export const AccommodationDetailSchema = createDetailSchema(AccommodationCoreSchema).extend({
    // Add all optional complex fields with proper types
    price: AccommodationPriceSchema.shape.price.optional(),
    features: AccommodationFeaturesSchema.shape.features.optional(),
    amenities: AccommodationAmenitiesSchema.shape.amenities.optional(),
    reviews: AccommodationReviewsSchema.shape.reviews.optional(),
    schedule: AccommodationScheduleSchema.shape.schedule.optional(),
    extraInfo: AccommodationExtraInfoSchema.shape.extraInfo.optional(),
    faqs: AccommodationFaqsSchema.shape.faqs.optional(),
    iaData: AccommodationIaDataSchema.shape.iaData.optional(),
    owner: z
        .object({
            id: z.string(),
            name: z.string(),
            email: z.string().email().optional()
        })
        .optional(),
    destination: z
        .object({
            id: z.string(),
            name: z.string(),
            country: z.string().optional()
        })
        .optional()
});

/**
 * Schema for accommodation creation (omits server-generated fields)
 * Used in: POST /accommodations
 */
export const AccommodationCreateCompositionSchema = createCreateSchema(
    AccommodationCoreSchema
).extend({
    // Add optional fields that can be provided during creation
    price: AccommodationPriceSchema.shape.price.optional(),
    features: AccommodationFeaturesSchema.shape.features.optional(),
    amenities: AccommodationAmenitiesSchema.shape.amenities.optional(),
    schedule: AccommodationScheduleSchema.shape.schedule.optional(),
    extraInfo: AccommodationExtraInfoSchema.shape.extraInfo.optional(),
    faqs: AccommodationFaqsSchema.shape.faqs.optional(),
    iaData: AccommodationIaDataSchema.shape.iaData.optional()
});

/**
 * Schema for accommodation updates (all fields optional)
 * Used in: PUT /accommodations/:id, PATCH /accommodations/:id
 */
export const AccommodationUpdateCompositionSchema = createUpdateSchema(
    AccommodationCreateCompositionSchema
);

/**
 * Schema for accommodation search filters
 * Used in: GET /accommodations (query parameters)
 */
export const AccommodationSearchFiltersSchema = z.object({
    // Text search
    q: z.string().optional(),

    // Location filters
    city: z.string().optional(),
    country: z.string().optional(),
    destinationId: z.string().optional(),

    // Status filters
    visibility: VisibilityEnumSchema.optional(),
    lifecycleState: LifecycleStatusEnumSchema.optional(),
    moderationState: ModerationStatusEnumSchema.optional(),
    isFeatured: z.boolean().optional(),

    // Rating filters
    minRating: z.number().min(0).max(5).optional(),
    maxRating: z.number().min(0).max(5).optional(),

    // Type filters
    type: AccommodationTypeEnumSchema.optional(),

    // Price filters
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),

    // Owner filters
    ownerId: z.string().optional()
});

/**
 * Schema for accommodation search sorting
 * Used in: GET /accommodations (query parameters)
 */
export const AccommodationSearchSortSchema = z.object({
    sortBy: z
        .enum(['name', 'createdAt', 'updatedAt', 'averageRating', 'reviewsCount', 'price'])
        .optional(),
    order: z.enum(['asc', 'desc']).optional()
});

/**
 * Schema for accommodation search pagination
 * Used in: GET /accommodations (query parameters)
 */
export const AccommodationSearchPaginationSchema = z.object({
    page: z.number().min(1).optional(),
    limit: z.number().min(1).max(100).optional()
});

/**
 * Complete schema for accommodation search
 * Used in: GET /accommodations
 */
export const AccommodationSearchCompositionSchema = AccommodationSearchFiltersSchema.merge(
    AccommodationSearchSortSchema
).merge(AccommodationSearchPaginationSchema);

/**
 * Schema for accommodation stats
 * Used in: GET /accommodations/stats
 */
export const AccommodationStatsSchema = z.object({
    total: z.number(),
    public: z.number(),
    private: z.number(),
    draft: z.number(),
    featured: z.number(),
    byType: z.record(z.string(), z.number()),
    byDestination: z.record(z.string(), z.number()),
    averageRating: z.number(),
    totalReviews: z.number()
});

/**
 * Schema for accommodation summary
 * Used in: GET /accommodations/:id/summary
 */
export const AccommodationSummarySchema = AccommodationCoreSchema.pick({
    id: true,
    slug: true,
    name: true,
    summary: true,
    type: true,
    isFeatured: true,
    visibility: true,
    lifecycleState: true,
    reviewsCount: true,
    averageRating: true,
    createdAt: true,
    updatedAt: true,
    ownerId: true,
    destinationId: true
}).extend({
    // Add minimal related data
    owner: z
        .object({
            id: z.string(),
            name: z.string()
        })
        .optional(),
    destination: z
        .object({
            id: z.string(),
            name: z.string()
        })
        .optional()
});

/**
 * Schema for accommodation by destination
 * Used in: GET /accommodations/destination/:destinationId
 */
export const AccommodationByDestinationSchema = z.object({
    destinationId: z.string(),
    accommodations: z.array(AccommodationListItemSchema)
});

/**
 * Schema for top rated accommodations by destination
 * Used in: GET /accommodations/destination/:destinationId/top-rated
 */
export const TopRatedAccommodationsSchema = z.object({
    destinationId: z.string(),
    accommodations: z.array(AccommodationListItemSchema)
});

/**
 * Type exports for all composition schemas
 */
export type AccommodationListItem = z.infer<typeof AccommodationListItemSchema>;
export type AccommodationDetail = z.infer<typeof AccommodationDetailSchema>;
export type AccommodationCreateComposition = z.infer<typeof AccommodationCreateCompositionSchema>;
export type AccommodationUpdateComposition = z.infer<typeof AccommodationUpdateCompositionSchema>;
export type AccommodationSearchFilters = z.infer<typeof AccommodationSearchFiltersSchema>;
export type AccommodationSearchSort = z.infer<typeof AccommodationSearchSortSchema>;
export type AccommodationSearchPagination = z.infer<typeof AccommodationSearchPaginationSchema>;
export type AccommodationSearchComposition = z.infer<typeof AccommodationSearchCompositionSchema>;
export type AccommodationStats = z.infer<typeof AccommodationStatsSchema>;
export type AccommodationSummary = z.infer<typeof AccommodationSummarySchema>;
export type AccommodationByDestination = z.infer<typeof AccommodationByDestinationSchema>;
export type TopRatedAccommodations = z.infer<typeof TopRatedAccommodationsSchema>;
