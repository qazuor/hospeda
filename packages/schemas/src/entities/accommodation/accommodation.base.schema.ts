import { z } from 'zod';
import { DestinationIdSchema, UserIdSchema } from '../../common/index.js';
import {
    addAdminFields,
    addContactFields,
    addLocationFields,
    addMediaFields,
    addSeoFields,
    addTagsFields,
    createBaseSchema
} from '../../common/schema-utils.js';
import {
    AccommodationTypeEnumSchema,
    LifecycleStatusEnumSchema,
    ModerationStatusEnumSchema,
    PriceCurrencyEnumSchema,
    VisibilityEnumSchema
} from '../../enums/index.js';

/**
 * Core Accommodation Schema
 *
 * This schema uses the new schema utilities to create a comprehensive
 * accommodation schema with maximum reuse and minimal boilerplate.
 */

/**
 * Core accommodation schema using common utilities
 */
export const AccommodationCoreSchema = createBaseSchema()
    .extend({
        // Accommodation-specific fields
        type: AccommodationTypeEnumSchema,
        destinationId: DestinationIdSchema,
        ownerId: UserIdSchema,
        lifecycleState: LifecycleStatusEnumSchema,
        moderationState: ModerationStatusEnumSchema,
        visibility: VisibilityEnumSchema,
        reviewsCount: z.number().int().min(0).default(0),
        averageRating: z.number().min(0).max(5).default(0)
    })
    .extend(addSeoFields(createBaseSchema()).shape)
    .extend(addContactFields(createBaseSchema()).shape)
    .extend(addLocationFields(createBaseSchema()).shape)
    .extend(addMediaFields(createBaseSchema()).shape)
    .extend(addTagsFields(createBaseSchema()).shape)
    .extend(addAdminFields(createBaseSchema()).shape);

/**
 * Schema for accommodation FAQs
 */
export const AccommodationFaqsSchema = z.object({
    faqs: z
        .array(
            z.object({
                id: z.string().uuid(),
                question: z.string().min(10).max(200),
                answer: z.string().min(10).max(1000),
                order: z.number().int().min(0)
            })
        )
        .optional()
});

/**
 * Schema for accommodation IA data
 */
export const AccommodationIaDataSchema = z.object({
    iaData: z
        .object({
            title: z.string(),
            content: z.string(),
            category: z.string().optional()
        })
        .optional()
});

/**
 * Schema for accommodation price
 */
export const AccommodationPriceSchema = z.object({
    price: z
        .object({
            price: z.number().positive(),
            currency: PriceCurrencyEnumSchema
        })
        .optional()
});

/**
 * Schema for accommodation features
 */
export const AccommodationFeaturesSchema = z.object({
    features: z
        .array(
            z.object({
                id: z.string().uuid(),
                name: z.string(),
                description: z.string().optional(),
                icon: z.string().optional(),
                category: z.string().optional()
            })
        )
        .optional()
});

/**
 * Schema for accommodation amenities
 */
export const AccommodationAmenitiesSchema = z.object({
    amenities: z
        .array(
            z.object({
                id: z.string().uuid(),
                name: z.string(),
                description: z.string().optional(),
                icon: z.string().optional(),
                category: z.string().optional(),
                isAvailable: z.boolean().default(true)
            })
        )
        .optional()
});

/**
 * Schema for accommodation reviews
 */
export const AccommodationReviewsSchema = z.object({
    reviews: z
        .array(
            z.object({
                id: z.string().uuid(),
                rating: z.number().min(1).max(5),
                comment: z.string().min(10).max(1000),
                reviewerName: z.string(),
                reviewerEmail: z.string().email().optional(),
                createdAt: z.coerce.date(),
                isVerified: z.boolean().default(false)
            })
        )
        .optional()
});

/**
 * Schema for accommodation schedule
 */
export const AccommodationScheduleSchema = z.object({
    schedule: z
        .object({
            checkInTime: z
                .string()
                .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
                .optional(),
            checkOutTime: z
                .string()
                .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
                .optional(),
            minStay: z.number().int().min(1).optional(),
            maxStay: z.number().int().min(1).optional(),
            availability: z
                .array(
                    z.object({
                        date: z.coerce.date(),
                        isAvailable: z.boolean(),
                        price: z.number().positive().optional()
                    })
                )
                .optional()
        })
        .optional()
});

/**
 * Schema for accommodation extra info
 */
export const AccommodationExtraInfoSchema = z.object({
    extraInfo: z
        .object({
            capacity: z.number().int(),
            minNights: z.number().int(),
            maxNights: z.number().int().optional(),
            bedrooms: z.number().int(),
            beds: z.number().int().optional(),
            bathrooms: z.number().int(),
            smokingAllowed: z.boolean().optional(),
            extraInfo: z.array(z.string()).optional()
        })
        .optional()
});

// Type exports
export type AccommodationCore = z.infer<typeof AccommodationCoreSchema>;
export type AccommodationFaqs = z.infer<typeof AccommodationFaqsSchema>;
export type AccommodationIaData = z.infer<typeof AccommodationIaDataSchema>;
export type AccommodationPrice = z.infer<typeof AccommodationPriceSchema>;
export type AccommodationFeatures = z.infer<typeof AccommodationFeaturesSchema>;
export type AccommodationAmenities = z.infer<typeof AccommodationAmenitiesSchema>;
export type AccommodationReviews = z.infer<typeof AccommodationReviewsSchema>;
export type AccommodationSchedule = z.infer<typeof AccommodationScheduleSchema>;
export type AccommodationExtraInfo = z.infer<typeof AccommodationExtraInfoSchema>;
