import {
    AccommodationFaqSchema,
    AccommodationIaDataSchema,
    AccommodationSchema,
    BaseSearchSchema,
    UserIdSchema
} from '@repo/schemas';
import { AccommodationTypeEnum, AmenitiesTypeEnum, VisibilityEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Schema for creating a new accommodation.
 * Derived from the base `AccommodationSchema` by omitting server-generated fields.
 */
export const CreateAccommodationSchema = AccommodationSchema.omit({
    id: true,
    slug: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true,
    owner: true,
    destination: true,
    features: true,
    amenities: true,
    reviews: true,
    rating: true,
    averageRating: true,
    schedule: true,
    extraInfo: true,
    faqs: true,
    iaData: true
});

/**
 * Schema for updating an existing accommodation.
 * It takes the creation schema and makes all fields optional, allowing for partial updates.
 */
export const UpdateAccommodationSchema = CreateAccommodationSchema.deepPartial();

/**
 * Defines the filters available when searching for accommodations.
 */
export const SearchAccommodationFiltersSchema = z.object({
    destinationId: z.string().optional(),
    type: z.string().optional(),
    amenities: z.array(z.string()).optional(),
    features: z.array(z.string()).optional(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    minRating: z.number().optional()
});

/**
 * Schema for fetching an accommodation along with its specified relations.
 */
export const GetWithRelationsInputSchema = z
    .object({
        id: z.string().uuid(),
        relations: z.record(z.boolean())
    })
    .strict();

/**
 * Schema for fetching accommodations belonging to a specific destination.
 */
export const GetByDestinationIdInputSchema = z
    .object({
        destinationId: z.string().uuid()
    })
    .strict();

/**
 * Schema for fetching accommodations of a specific type.
 */
export const GetByTypeInputSchema = z
    .object({
        type: z.string()
    })
    .strict();

/**
 * Schema for fetching accommodations that have a specific amenity.
 * Requires either the amenity's ID or its slug.
 */
export const GetByAmenityInputSchema = z
    .object({
        amenityId: z.string().uuid().optional(),
        amenitySlug: z.string().optional()
    })
    .strict()
    .superRefine((data, ctx) => {
        if (!data.amenityId && !data.amenitySlug) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Either amenityId or amenitySlug must be provided'
            });
        }
    });

/**
 * Schema for fetching accommodations that have a specific feature.
 * Requires either the feature's ID or its slug.
 */
export const GetByFeatureInputSchema = z
    .object({
        featureId: z.string().uuid().optional(),
        featureSlug: z.string().optional()
    })
    .strict()
    .superRefine((data, ctx) => {
        if (!data.featureId && !data.featureSlug) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Either featureId or featureSlug must be provided'
            });
        }
    });

/**
 * Schema for fetching a single accommodation, typically for a detail view.
 * Requires either the accommodation's ID or its slug.
 */
export const GetAccommodationSchema = z
    .object({
        id: z.string().uuid().optional(),
        slug: z.string().optional()
    })
    .strict()
    .superRefine((data, ctx) => {
        if (!data.id && !data.slug) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Either id or slug must be provided'
            });
        }
    });

/**
 * Schema for finding accommodations similar to a given one.
 * Reuses `GetAccommodationSchema` as it requires the same ID/slug input.
 */
export const GetSimilarInputSchema = GetAccommodationSchema;

/**
 * Schema for fetching the top-rated accommodations, optionally filtered by destination.
 */
export const GetTopRatedInputSchema = z
    .object({
        destinationId: z.string().uuid().optional()
    })
    .strict();

/**
 * Schema for fetching the reviews of a specific accommodation.
 * Reuses `GetAccommodationSchema` as it requires the same ID/slug input.
 */
export const GetReviewsInputSchema = GetAccommodationSchema;

/**
 * Schema for searching accommodations.
 * Extends the base search schema with accommodation-specific filters.
 */
export const SearchAccommodationSchema = BaseSearchSchema.extend({
    filters: z
        .object({
            types: z.array(z.nativeEnum(AccommodationTypeEnum)).optional(),
            priceMin: z.number().min(0).optional(),
            priceMax: z.number().min(0).optional(),
            amenities: z.array(z.nativeEnum(AmenitiesTypeEnum)).optional(),
            visibility: z.array(z.nativeEnum(VisibilityEnum)).optional(),
            ownerId: UserIdSchema.optional()
        })
        .optional()
}).strict();

/**
 * Schema for updating an accommodation's visibility.
 */
export const UpdateVisibilitySchema = z
    .object({
        visibility: z.nativeEnum(VisibilityEnum)
    })
    .strict();

/**
 * Schema for adding a FAQ to an accommodation.
 */
export const AddFaqInputSchema = z
    .object({
        accommodationId: z.string().uuid(),
        faq: AccommodationFaqSchema.omit({
            id: true,
            createdAt: true,
            updatedAt: true,
            createdById: true,
            updatedById: true,
            lifecycleState: true,
            adminInfo: true
        })
    })
    .strict();

/**
 * Schema for removing a FAQ from an accommodation.
 */
export const RemoveFaqInputSchema = z
    .object({
        accommodationId: z.string().uuid(),
        faqId: z.string().uuid()
    })
    .strict();

/**
 * Schema for updating a FAQ for an accommodation.
 */
export const UpdateFaqInputSchema = z
    .object({
        accommodationId: z.string().uuid(),
        faqId: z.string().uuid(),
        faq: AccommodationFaqSchema.omit({
            id: true,
            createdAt: true,
            updatedAt: true,
            createdById: true,
            updatedById: true,
            lifecycleState: true,
            adminInfo: true
        })
    })
    .strict();

/**
 * Schema for getting FAQs for an accommodation.
 */
export const GetFaqsInputSchema = z
    .object({
        accommodationId: z.string().uuid()
    })
    .strict();

/**
 * Schema for adding AI data to an accommodation.
 */
export const AddIADataInputSchema = z
    .object({
        accommodationId: z.string().uuid(),
        iaData: AccommodationIaDataSchema.omit({
            id: true,
            createdAt: true,
            updatedAt: true,
            createdById: true,
            updatedById: true,
            lifecycleState: true,
            adminInfo: true
        })
    })
    .strict();

/**
 * Schema for removing AI data from an accommodation.
 */
export const RemoveIADataInputSchema = z
    .object({
        accommodationId: z.string().uuid(),
        iaDataId: z.string().uuid()
    })
    .strict();

/**
 * Schema for updating AI data for an accommodation.
 */
export const UpdateIADataInputSchema = z
    .object({
        accommodationId: z.string().uuid(),
        iaDataId: z.string().uuid(),
        iaData: AccommodationIaDataSchema.omit({
            id: true,
            createdAt: true,
            updatedAt: true,
            createdById: true,
            updatedById: true,
            lifecycleState: true,
            adminInfo: true
        })
    })
    .strict();

/**
 * Schema for getting AI data for an accommodation.
 */
export const GetIADataInputSchema = z
    .object({
        accommodationId: z.string().uuid()
    })
    .strict();

// --- Inferred Types ---

/** @see SearchAccommodationFiltersSchema */
export type SearchAccommodationFilters = z.infer<typeof SearchAccommodationFiltersSchema>;
/** @see CreateAccommodationSchema */
export type NewAccommodationInput = z.infer<typeof CreateAccommodationSchema>;
/** @see UpdateAccommodationSchema */
export type UpdateAccommodationInput = z.infer<typeof UpdateAccommodationSchema>;
/** @see GetWithRelationsInputSchema */
export type GetWithRelationsInput = z.infer<typeof GetWithRelationsInputSchema>;
/** @see GetByDestinationIdInputSchema */
export type GetByDestinationIdInput = z.infer<typeof GetByDestinationIdInputSchema>;
/** @see GetByTypeInputSchema */
export type GetByTypeInput = z.infer<typeof GetByTypeInputSchema>;
/** @see GetByAmenityInputSchema */
export type GetByAmenityInput = z.infer<typeof GetByAmenityInputSchema>;
/** @see GetByFeatureInputSchema */
export type GetByFeatureInput = z.infer<typeof GetByFeatureInputSchema>;
/** @see GetAccommodationSchema */
export type GetSummaryInput = z.infer<typeof GetAccommodationSchema>;
/** @see GetSimilarInputSchema */
export type GetSimilarInput = z.infer<typeof GetSimilarInputSchema>;
/** @see GetTopRatedInputSchema */
export type GetTopRatedInput = z.infer<typeof GetTopRatedInputSchema>;
/** @see GetReviewsInputSchema */
export type GetReviewsInput = z.infer<typeof GetReviewsInputSchema>;
/** @see AddFaqInputSchema */
export type AddFaqInput = z.infer<typeof AddFaqInputSchema>;
/** @see RemoveFaqInputSchema */
export type RemoveFaqInput = z.infer<typeof RemoveFaqInputSchema>;
/** @see UpdateFaqInputSchema */
export type UpdateFaqInput = z.infer<typeof UpdateFaqInputSchema>;
/** @see GetFaqsInputSchema */
export type GetFaqsInput = z.infer<typeof GetFaqsInputSchema>;

export type AddIADataInput = z.infer<typeof AddIADataInputSchema>;
export type RemoveIADataInput = z.infer<typeof RemoveIADataInputSchema>;
export type UpdateIADataInput = z.infer<typeof UpdateIADataInputSchema>;
export type GetIADataInput = z.infer<typeof GetIADataInputSchema>;
