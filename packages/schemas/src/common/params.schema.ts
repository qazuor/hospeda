import { z } from 'zod';
import {
    AccommodationIdSchema,
    AmenityIdSchema,
    DestinationIdSchema,
    EventIdSchema,
    FeatureIdSchema,
    PaymentIdSchema,
    PostIdSchema,
    TagIdSchema,
    UserIdSchema
} from './id.schema.js';

/**
 * Common API Parameter Schemas
 *
 * This file contains reusable schemas for API path parameters:
 * - Generic ID parameters
 * - Slug parameters
 * - Entity-specific ID parameters
 */

// ============================================================================
// GENERIC PARAMETER SCHEMAS
// ============================================================================

/**
 * Schema for generic ID path parameters
 * Used for endpoints that accept any UUID identifier
 */
export const IdParamsSchema = z.object({
    id: z
        .string({
            message: 'zodError.params.id.required'
        })
        .uuid({ message: 'zodError.params.id.uuid' })
});

/**
 * Schema for slug path parameters
 * Used for endpoints that accept URL-friendly string identifiers
 */
export const SlugParamsSchema = z.object({
    slug: z
        .string({
            message: 'zodError.params.slug.required'
        })
        .min(1, { message: 'zodError.params.slug.min' })
        .max(100, { message: 'zodError.params.slug.max' })
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'zodError.params.slug.format'
        })
});

/**
 * Schema for combined ID or slug parameters
 * Used for endpoints that accept either UUID or slug
 */
export const IdOrSlugParamsSchema = z.object({
    idOrSlug: z
        .string({
            message: 'zodError.params.idOrSlug.required'
        })
        .min(1, { message: 'zodError.params.idOrSlug.min' })
        .refine(
            (value) => {
                // Check if it's a valid UUID
                const uuidRegex =
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                // Check if it's a valid slug
                const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
                return uuidRegex.test(value) || slugRegex.test(value);
            },
            {
                message: 'zodError.params.idOrSlug.format'
            }
        )
});

// ============================================================================
// ENTITY-SPECIFIC ID PARAMETER SCHEMAS
// ============================================================================

/**
 * Schema for User ID path parameters
 * Used for user-specific endpoints
 */
export const UserIdParamsSchema = z.object({
    userId: UserIdSchema,
    id: UserIdSchema.optional() // Alternative parameter name
});

/**
 * Schema for Accommodation ID path parameters
 * Used for accommodation-specific endpoints
 */
export const AccommodationIdParamsSchema = z.object({
    accommodationId: AccommodationIdSchema,
    id: AccommodationIdSchema.optional() // Alternative parameter name
});

/**
 * Schema for Destination ID path parameters
 * Used for destination-specific endpoints
 */
export const DestinationIdParamsSchema = z.object({
    destinationId: DestinationIdSchema,
    id: DestinationIdSchema.optional() // Alternative parameter name
});

/**
 * Schema for Post ID path parameters
 * Used for post-specific endpoints
 */
export const PostIdParamsSchema = z.object({
    postId: PostIdSchema,
    id: PostIdSchema.optional() // Alternative parameter name
});

/**
 * Schema for Event ID path parameters
 * Used for event-specific endpoints
 */
export const EventIdParamsSchema = z.object({
    eventId: EventIdSchema,
    id: EventIdSchema.optional() // Alternative parameter name
});

/**
 * Schema for Tag ID path parameters
 * Used for tag-specific endpoints
 */
export const TagIdParamsSchema = z.object({
    tagId: TagIdSchema,
    id: TagIdSchema.optional() // Alternative parameter name
});

/**
 * Schema for Amenity ID path parameters
 * Used for amenity-specific endpoints
 */
export const AmenityIdParamsSchema = z.object({
    amenityId: AmenityIdSchema,
    id: AmenityIdSchema.optional() // Alternative parameter name
});

/**
 * Schema for Feature ID path parameters
 * Used for feature-specific endpoints
 */
export const FeatureIdParamsSchema = z.object({
    featureId: FeatureIdSchema,
    id: FeatureIdSchema.optional() // Alternative parameter name
});

/**
 * Schema for Payment ID path parameters
 * Used for payment-specific endpoints
 */
export const PaymentIdParamsSchema = z.object({
    paymentId: PaymentIdSchema,
    id: PaymentIdSchema.optional() // Alternative parameter name
});

// ============================================================================
// SPECIAL ENTITY PARAMETER SCHEMAS
// ============================================================================

/**
 * Schema for FAQ ID path parameters
 * Used for FAQ-specific endpoints
 */
export const FaqIdParamsSchema = z.object({
    faqId: z
        .string({
            message: 'zodError.params.faqId.required'
        })
        .uuid({ message: 'zodError.params.faqId.uuid' }),
    id: z
        .string({
            message: 'zodError.params.id.required'
        })
        .uuid({ message: 'zodError.params.id.uuid' })
        .optional() // Alternative parameter name
});

/**
 * Schema for Review ID path parameters
 * Used for review-specific endpoints
 */
export const ReviewIdParamsSchema = z.object({
    reviewId: z
        .string({
            message: 'zodError.params.reviewId.required'
        })
        .uuid({ message: 'zodError.params.reviewId.uuid' }),
    id: z
        .string({
            message: 'zodError.params.id.required'
        })
        .uuid({ message: 'zodError.params.id.uuid' })
        .optional() // Alternative parameter name
});

// ============================================================================
// NESTED PARAMETER SCHEMAS
// ============================================================================

/**
 * Schema for nested resource parameters
 * Used for endpoints with parent-child relationships
 */
export const NestedParamsSchema = z.object({
    parentId: z
        .string({
            message: 'zodError.params.parentId.required'
        })
        .uuid({ message: 'zodError.params.parentId.uuid' }),
    childId: z
        .string({
            message: 'zodError.params.childId.required'
        })
        .uuid({ message: 'zodError.params.childId.uuid' })
});

/**
 * Schema for accommodation FAQ parameters
 * Used for accommodation FAQ endpoints
 */
export const AccommodationFaqParamsSchema = z.object({
    accommodationId: AccommodationIdSchema,
    faqId: z
        .string({
            message: 'zodError.params.faqId.required'
        })
        .uuid({ message: 'zodError.params.faqId.uuid' })
});

/**
 * Schema for accommodation review parameters
 * Used for accommodation review endpoints
 */
export const AccommodationReviewParamsSchema = z.object({
    accommodationId: AccommodationIdSchema,
    reviewId: z
        .string({
            message: 'zodError.params.reviewId.required'
        })
        .uuid({ message: 'zodError.params.reviewId.uuid' })
});

/**
 * Schema for destination review parameters
 * Used for destination review endpoints
 */
export const DestinationReviewParamsSchema = z.object({
    destinationId: DestinationIdSchema,
    reviewId: z
        .string({
            message: 'zodError.params.reviewId.required'
        })
        .uuid({ message: 'zodError.params.reviewId.uuid' })
});

/**
 * Schema for user accommodation parameters
 * Used for user's accommodation endpoints
 */
export const UserAccommodationParamsSchema = z.object({
    userId: UserIdSchema,
    accommodationId: AccommodationIdSchema
});

/**
 * Schema for user payment parameters
 * Used for user's payment endpoints
 */
export const UserPaymentParamsSchema = z.object({
    userId: UserIdSchema,
    paymentId: PaymentIdSchema
});

// ============================================================================
// MULTI-ENTITY PARAMETER SCHEMAS
// ============================================================================

/**
 * Schema for accommodation amenity parameters
 * Used for accommodation-amenity relationship endpoints
 */
export const AccommodationAmenityParamsSchema = z.object({
    accommodationId: AccommodationIdSchema,
    amenityId: AmenityIdSchema
});

/**
 * Schema for accommodation feature parameters
 * Used for accommodation-feature relationship endpoints
 */
export const AccommodationFeatureParamsSchema = z.object({
    accommodationId: AccommodationIdSchema,
    featureId: FeatureIdSchema
});

/**
 * Schema for post tag parameters
 * Used for post-tag relationship endpoints
 */
export const PostTagParamsSchema = z.object({
    postId: PostIdSchema,
    tagId: TagIdSchema
});

/**
 * Schema for event tag parameters
 * Used for event-tag relationship endpoints
 */
export const EventTagParamsSchema = z.object({
    eventId: EventIdSchema,
    tagId: TagIdSchema
});

// ============================================================================
// OPTIONAL PARAMETER SCHEMAS
// ============================================================================

/**
 * Schema for optional ID parameters
 * Used for endpoints where ID might be optional
 */
export const OptionalIdParamsSchema = z.object({
    id: z
        .string({
            message: 'zodError.params.id.invalidType'
        })
        .uuid({ message: 'zodError.params.id.uuid' })
        .optional()
});

/**
 * Schema for optional slug parameters
 * Used for endpoints where slug might be optional
 */
export const OptionalSlugParamsSchema = z.object({
    slug: z
        .string({
            message: 'zodError.params.slug.invalidType'
        })
        .min(1, { message: 'zodError.params.slug.min' })
        .max(100, { message: 'zodError.params.slug.max' })
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'zodError.params.slug.format'
        })
        .optional()
});

// ============================================================================
// VALIDATION HELPER SCHEMAS
// ============================================================================

/**
 * Schema for version parameters
 * Used for API versioning in path parameters
 */
export const VersionParamsSchema = z.object({
    version: z
        .string({
            message: 'zodError.params.version.required'
        })
        .regex(/^v\d+$/, {
            message: 'zodError.params.version.format'
        })
});

/**
 * Schema for language parameters
 * Used for internationalization in path parameters
 */
export const LanguageParamsSchema = z.object({
    lang: z
        .string({
            message: 'zodError.params.lang.required'
        })
        .length(2, { message: 'zodError.params.lang.length' })
        .regex(/^[a-z]{2}$/, {
            message: 'zodError.params.lang.format'
        })
});

/**
 * Schema for locale parameters
 * Used for full locale specification in path parameters
 */
export const LocaleParamsSchema = z.object({
    locale: z
        .string({
            message: 'zodError.params.locale.required'
        })
        .regex(/^[a-z]{2}(-[A-Z]{2})?$/, {
            message: 'zodError.params.locale.format'
        })
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type IdParams = z.infer<typeof IdParamsSchema>;
export type SlugParams = z.infer<typeof SlugParamsSchema>;
export type IdOrSlugParams = z.infer<typeof IdOrSlugParamsSchema>;
export type UserIdParams = z.infer<typeof UserIdParamsSchema>;
export type AccommodationIdParams = z.infer<typeof AccommodationIdParamsSchema>;
export type DestinationIdParams = z.infer<typeof DestinationIdParamsSchema>;
export type PostIdParams = z.infer<typeof PostIdParamsSchema>;
export type EventIdParams = z.infer<typeof EventIdParamsSchema>;
export type TagIdParams = z.infer<typeof TagIdParamsSchema>;
export type AmenityIdParams = z.infer<typeof AmenityIdParamsSchema>;
export type FeatureIdParams = z.infer<typeof FeatureIdParamsSchema>;
export type PaymentIdParams = z.infer<typeof PaymentIdParamsSchema>;
export type FaqIdParams = z.infer<typeof FaqIdParamsSchema>;
export type ReviewIdParams = z.infer<typeof ReviewIdParamsSchema>;
export type NestedParams = z.infer<typeof NestedParamsSchema>;
export type AccommodationFaqParams = z.infer<typeof AccommodationFaqParamsSchema>;
export type AccommodationReviewParams = z.infer<typeof AccommodationReviewParamsSchema>;
export type DestinationReviewParams = z.infer<typeof DestinationReviewParamsSchema>;
export type UserAccommodationParams = z.infer<typeof UserAccommodationParamsSchema>;
export type UserPaymentParams = z.infer<typeof UserPaymentParamsSchema>;
export type AccommodationAmenityParams = z.infer<typeof AccommodationAmenityParamsSchema>;
export type AccommodationFeatureParams = z.infer<typeof AccommodationFeatureParamsSchema>;
export type PostTagParams = z.infer<typeof PostTagParamsSchema>;
export type EventTagParams = z.infer<typeof EventTagParamsSchema>;
export type OptionalIdParams = z.infer<typeof OptionalIdParamsSchema>;
export type OptionalSlugParams = z.infer<typeof OptionalSlugParamsSchema>;
export type VersionParams = z.infer<typeof VersionParamsSchema>;
export type LanguageParams = z.infer<typeof LanguageParamsSchema>;
export type LocaleParams = z.infer<typeof LocaleParamsSchema>;
