import { z } from '@hono/zod-openapi';

// Import modular schemas from @repo/schemas for validation
import {
    AccommodationByDestinationOutputSchema,
    AccommodationByDestinationParamsSchema,
    AccommodationCreateInputSchema,
    AccommodationFaqAddInputSchema,
    AccommodationFaqRemoveInputSchema,
    AccommodationFaqUpdateInputSchema,
    AccommodationFiltersSchema,
    AccommodationListItemSchema,
    AccommodationSchema,
    AccommodationSearchResultSchema,
    AccommodationSearchSchema,
    AccommodationStatsSchema,
    AccommodationSummarySchema,
    AccommodationTopRatedOutputSchema,
    AccommodationUpdateInputSchema
} from '@repo/schemas';

// Re-export with expected names for backward compatibility
export const AccommodationDetailSchema = AccommodationSchema;
export const AccommodationByDestinationSchema = AccommodationByDestinationOutputSchema;
export const AccommodationSearchCompositionSchema = AccommodationSearchSchema;
export const AccommodationSearchFiltersSchema = AccommodationFiltersSchema;
export const AccommodationSearchPaginationSchema = AccommodationSearchResultSchema;
export const AccommodationSearchSortSchema = AccommodationSearchSchema;
export const TopRatedAccommodationsSchema = AccommodationTopRatedOutputSchema;

// Service schemas - mapped to correct schemas
export const AddFaqServiceSchema = AccommodationFaqAddInputSchema;
export const CreateAccommodationServiceSchema = AccommodationCreateInputSchema;
export const GetAccommodationServiceSchema = AccommodationSchema;
export const GetByDestinationServiceSchema = AccommodationByDestinationParamsSchema;
export const GetFaqsServiceSchema = z.object({
    accommodationId: z.string()
});
export const GetTopRatedServiceSchema = z.object({});
export const RemoveFaqServiceSchema = AccommodationFaqRemoveInputSchema;
export const SearchAccommodationServiceSchema = AccommodationSearchSchema;
export const UpdateAccommodationServiceSchema = AccommodationUpdateInputSchema;
export const UpdateFaqServiceSchema = AccommodationFaqUpdateInputSchema;

/**
 * Accommodation API schemas - Optimized for maximum reuse
 * Uses schemas from @repo/schemas to maintain single source of truth
 */

/**
 * Accommodation response schemas using modular approach
 * These replace the monolithic AccommodationSchema to avoid circular dependencies
 */

// List item schema for GET /accommodations
export const accommodationListItemSchema = z
    .object(AccommodationListItemSchema.shape)
    .openapi('AccommodationListItem');

// Detail schema for GET /accommodations/:id
export const accommodationDetailSchema = z
    .object(AccommodationDetailSchema.shape)
    .openapi('AccommodationDetail');

// Summary schema for GET /accommodations/:id/summary
export const accommodationSummarySchema = z
    .object(AccommodationSummarySchema.shape)
    .openapi('AccommodationSummary');

// Stats schema for GET /accommodations/stats
export const accommodationStatsSchema = z
    .object(AccommodationStatsSchema.shape)
    .openapi('AccommodationStats');

// By destination schema for GET /accommodations/destination/:destinationId
export const accommodationByDestinationSchema = z
    .object(AccommodationByDestinationSchema.shape)
    .openapi('AccommodationByDestination');

// Top rated schema for GET /accommodations/destination/:destinationId/top-rated
export const topRatedAccommodationsSchema = z
    .object(TopRatedAccommodationsSchema.shape)
    .openapi('TopRatedAccommodations');

/**
 * Accommodation creation schema for API input
 * Reuses CreateAccommodationServiceSchema from @repo/schemas
 */
export const accommodationCreateSchema = z
    .object(CreateAccommodationServiceSchema.shape)
    .openapi('AccommodationCreate');

/**
 * Accommodation update schema for API input
 * Reuses UpdateAccommodationServiceSchema from @repo/schemas
 */
export const accommodationUpdateSchema = z
    .object(UpdateAccommodationServiceSchema.shape)
    .openapi('AccommodationUpdate');

/**
 * Search schemas for GET /accommodations
 */
export const accommodationSearchFiltersSchema = z
    .object(AccommodationSearchFiltersSchema.shape)
    .openapi('AccommodationSearchFilters');

export const accommodationSearchSortSchema = z
    .object(AccommodationSearchSortSchema.shape)
    .openapi('AccommodationSearchSort');

export const accommodationSearchPaginationSchema = z
    .object(AccommodationSearchPaginationSchema.shape)
    .openapi('AccommodationSearchPagination');

export const accommodationSearchCompositionSchema = z
    .object(AccommodationSearchCompositionSchema.shape)
    .openapi('AccommodationSearchComposition');

/**
 * Updated schemas using modular approach
 */
export const accommodationSchema = accommodationDetailSchema;
export const accommodationListSchema = z
    .array(accommodationListItemSchema)
    .openapi('AccommodationList');

/**
 * Parameter schemas for route validation
 */
export const ParamsSchema = z.object({
    id: z
        .string()
        .uuid('Invalid accommodation ID format')
        .openapi({
            param: { name: 'id', in: 'path' },
            example: 'acc_1234567890'
        })
});

export const SlugParamsSchema = z.object({
    slug: z
        .string()
        .min(1, 'Slug is required')
        .openapi({
            param: { name: 'slug', in: 'path' },
            example: 'luxury-hotel-barcelona'
        })
});

/**
 * FAQ-related schemas for API input/output
 */
export const FaqParamsSchema = z.object({
    id: z
        .string()
        .uuid('Invalid accommodation ID format')
        .openapi({
            param: { name: 'id', in: 'path' },
            example: 'acc_1234567890'
        }),
    faqId: z
        .string()
        .uuid('Invalid FAQ ID format')
        .openapi({
            param: { name: 'faqId', in: 'path' },
            example: 'faq_1234567890'
        })
});

export const faqResponseSchema = z
    .object({
        id: z.string(),
        question: z.string(),
        answer: z.string(),
        order: z.number(),
        createdAt: z.string(),
        updatedAt: z.string()
    })
    .openapi('FaqResponse');

export const faqListResponseSchema = z
    .object({
        faqs: z.array(faqResponseSchema)
    })
    .openapi('FaqListResponse');

export const successResponseSchema = z
    .object({
        success: z.boolean()
    })
    .openapi('SuccessResponse');

export const faqCreateSchema = z.object(AddFaqServiceSchema.shape.faq.shape).openapi('FaqCreate');

export const faqUpdateSchema = faqCreateSchema.partial().openapi('FaqUpdate');

/**
 * Service schemas for API validation
 */
export const getAccommodationSchema = z
    .object(GetAccommodationServiceSchema.shape)
    .openapi('GetAccommodation');
export const searchAccommodationSchema = z
    .object(SearchAccommodationServiceSchema.shape)
    .openapi('SearchAccommodation');
export const getByDestinationSchema = z
    .object(GetByDestinationServiceSchema.shape)
    .openapi('GetByDestination');
export const getTopRatedSchema = z.object(GetTopRatedServiceSchema.shape).openapi('GetTopRated');
export const addFaqSchema = z.object(AddFaqServiceSchema.shape).openapi('AddFaq');
export const removeFaqSchema = z.object(RemoveFaqServiceSchema.shape).openapi('RemoveFaq');
export const updateFaqSchema = z.object(UpdateFaqServiceSchema.shape).openapi('UpdateFaq');
export const getFaqsSchema = z.object(GetFaqsServiceSchema.shape).openapi('GetFaqs');
