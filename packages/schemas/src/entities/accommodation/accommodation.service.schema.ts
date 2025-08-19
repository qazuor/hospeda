import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import { BaseSearchSchema } from '../../common/search.schemas.js';
import { VisibilityEnumSchema } from '../../enums/index.js';
import {
    AccommodationAmenitiesSchema,
    AccommodationCoreSchema,
    AccommodationExtraInfoSchema,
    AccommodationFaqsSchema,
    AccommodationFeaturesSchema,
    AccommodationIaDataSchema,
    AccommodationPriceSchema,
    AccommodationScheduleSchema
} from './accommodation.base.schema.js';

/**
 * Service Layer Schemas for Accommodation Entity
 *
 * These schemas are specifically designed for the service layer
 * and contain business logic validation rules.
 */

/**
 * Schema for creating a new accommodation.
 * Omits server-generated fields and complex relations.
 */
export const CreateAccommodationServiceSchema = AccommodationCoreSchema.omit({
    id: true,
    slug: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    reviewsCount: true,
    averageRating: true
}).extend({
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
 * Schema for updating an existing accommodation.
 * All fields are optional for partial updates.
 */
export const UpdateAccommodationServiceSchema = CreateAccommodationServiceSchema.partial();

/**
 * Schema for fetching an accommodation by ID or slug.
 */
export const GetAccommodationServiceSchema = z
    .object({
        id: z.string().uuid().optional(),
        slug: z.string().optional()
    })
    .superRefine((data, ctx) => {
        if (!data.id && !data.slug) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Either id or slug must be provided'
            });
        }
    });

/**
 * Schema for searching accommodations with filters.
 */
export const SearchAccommodationServiceSchema = BaseSearchSchema.extend({
    filters: z
        .object({
            destinationId: z.string().uuid().optional(),
            type: z.string().optional(),
            types: z.array(z.string()).optional(),
            amenities: z.array(z.string()).optional(),
            features: z.array(z.string()).optional(),
            minPrice: z.number().optional(),
            maxPrice: z.number().optional(),
            minRating: z.number().optional(),
            visibility: z.array(VisibilityEnumSchema).optional(),
            ownerId: UserIdSchema.optional()
        })
        .optional()
});

/**
 * Schema for getting accommodations by destination.
 */
export const GetByDestinationServiceSchema = z.object({
    destinationId: z.string().uuid()
});

/**
 * Schema for getting accommodations by type.
 */
export const GetByTypeServiceSchema = z.object({
    type: z.string()
});

/**
 * Schema for getting accommodations by amenity.
 */
export const GetByAmenityServiceSchema = z
    .object({
        amenityId: z.string().uuid().optional(),
        amenitySlug: z.string().optional()
    })
    .superRefine((data, ctx) => {
        if (!data.amenityId && !data.amenitySlug) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Either amenityId or amenitySlug must be provided'
            });
        }
    });

/**
 * Schema for getting accommodations by feature.
 */
export const GetByFeatureServiceSchema = z
    .object({
        featureId: z.string().uuid().optional(),
        featureSlug: z.string().optional()
    })
    .superRefine((data, ctx) => {
        if (!data.featureId && !data.featureSlug) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Either featureId or featureSlug must be provided'
            });
        }
    });

/**
 * Schema for getting top rated accommodations.
 * - limit: optional, defaults to 10
 * - destinationId: optional filter
 * - type: optional filter
 * - onlyFeatured: optional, defaults to false
 */
export const GetTopRatedServiceSchema = z
    .object({
        limit: z.number().int().min(1).max(100).optional().default(10),
        destinationId: z.string().uuid().optional(),
        type: z.string().optional(),
        onlyFeatured: z.boolean().optional().default(false)
    })
    .strict();

/**
 * Schema for getting similar accommodations.
 */
export const GetSimilarServiceSchema = GetAccommodationServiceSchema;

/**
 * Schema for getting accommodation reviews.
 */
export const GetReviewsServiceSchema = GetAccommodationServiceSchema;

/**
 * Schema for updating accommodation visibility.
 */
export const UpdateVisibilityServiceSchema = z.object({
    visibility: VisibilityEnumSchema
});

/**
 * Schema for getting accommodation with relations.
 */
export const GetWithRelationsServiceSchema = z.object({
    id: z.string().uuid(),
    relations: z.record(z.string(), z.boolean())
});

// --- FAQ Service Schemas ---

/**
 * Schema for adding a FAQ to an accommodation.
 */
export const AddFaqServiceSchema = z.object({
    accommodationId: z.string().uuid(),
    faq: z.object({
        question: z.string().min(10).max(200),
        answer: z.string().min(10).max(1000),
        order: z.number().int().min(0).optional()
    })
});

/**
 * Schema for removing a FAQ from an accommodation.
 */
export const RemoveFaqServiceSchema = z.object({
    accommodationId: z.string().uuid(),
    faqId: z.string().uuid()
});

/**
 * Schema for updating a FAQ for an accommodation.
 */
export const UpdateFaqServiceSchema = z.object({
    accommodationId: z.string().uuid(),
    faqId: z.string().uuid(),
    faq: z.object({
        question: z.string().min(10).max(200),
        answer: z.string().min(10).max(1000),
        order: z.number().int().min(0).optional()
    })
});

/**
 * Schema for getting FAQs for an accommodation.
 */
export const GetFaqsServiceSchema = z.object({
    accommodationId: z.string().uuid()
});

// --- IA Data Service Schemas ---

/**
 * Schema for adding AI data to an accommodation.
 */
export const AddIaDataServiceSchema = z.object({
    accommodationId: z.string().uuid(),
    iaData: z.object({
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(2000),
        category: z.string().optional()
    })
});

/**
 * Schema for removing AI data from an accommodation.
 */
export const RemoveIaDataServiceSchema = z.object({
    accommodationId: z.string().uuid(),
    iaDataId: z.string().uuid()
});

/**
 * Schema for updating AI data for an accommodation.
 */
export const UpdateIaDataServiceSchema = z.object({
    accommodationId: z.string().uuid(),
    iaDataId: z.string().uuid(),
    iaData: z.object({
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(2000),
        category: z.string().optional()
    })
});

/**
 * Schema for getting AI data for an accommodation.
 */
export const GetIaDataServiceSchema = z.object({
    accommodationId: z.string().uuid()
});

// --- Type Exports ---

export type CreateAccommodationService = z.infer<typeof CreateAccommodationServiceSchema>;
export type UpdateAccommodationService = z.infer<typeof UpdateAccommodationServiceSchema>;
export type GetAccommodationService = z.infer<typeof GetAccommodationServiceSchema>;
export type SearchAccommodationService = z.infer<typeof SearchAccommodationServiceSchema>;
export type GetByDestinationService = z.infer<typeof GetByDestinationServiceSchema>;
export type GetByTypeService = z.infer<typeof GetByTypeServiceSchema>;
export type GetByAmenityService = z.infer<typeof GetByAmenityServiceSchema>;
export type GetByFeatureService = z.infer<typeof GetByFeatureServiceSchema>;
export type GetTopRatedService = z.infer<typeof GetTopRatedServiceSchema>;
export type GetSimilarService = z.infer<typeof GetSimilarServiceSchema>;
export type GetReviewsService = z.infer<typeof GetReviewsServiceSchema>;
export type UpdateVisibilityService = z.infer<typeof UpdateVisibilityServiceSchema>;
export type GetWithRelationsService = z.infer<typeof GetWithRelationsServiceSchema>;

// FAQ Service Types
export type AddFaqService = z.infer<typeof AddFaqServiceSchema>;
export type RemoveFaqService = z.infer<typeof RemoveFaqServiceSchema>;
export type UpdateFaqService = z.infer<typeof UpdateFaqServiceSchema>;
export type GetFaqsService = z.infer<typeof GetFaqsServiceSchema>;

// IA Data Service Types
export type AddIaDataService = z.infer<typeof AddIaDataServiceSchema>;
export type RemoveIaDataService = z.infer<typeof RemoveIaDataServiceSchema>;
export type UpdateIaDataService = z.infer<typeof UpdateIaDataServiceSchema>;
export type GetIaDataService = z.infer<typeof GetIaDataServiceSchema>;
