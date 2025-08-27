import {
    AccommodationTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PriceCurrencyEnum,
    VisibilityEnum
} from '@repo/types';
import { z } from 'zod';

/**
 * Schema for accommodation detail view
 */
export const AccommodationDetailSchema = z
    .object({
        id: z.string(),
        slug: z.string(),
        name: z.string(),
        summary: z.string().optional(),
        description: z.string().optional(),
        type: z.nativeEnum(AccommodationTypeEnum).optional(),

        // Destination relation
        destination: z
            .object({
                id: z.string(),
                name: z.string(),
                slug: z.string()
            })
            .nullable()
            .optional(),
        destinationId: z.string().nullable().optional(),

        // Owner relation
        owner: z
            .object({
                id: z.string(),
                displayName: z.string()
            })
            .nullable()
            .optional(),
        ownerId: z.string().nullable().optional(),

        // Pricing
        price: z
            .object({
                amount: z.number().optional(),
                currency: z.nativeEnum(PriceCurrencyEnum).optional()
            })
            .nullable()
            .optional(),
        basePrice: z.number().optional(),
        currency: z.nativeEnum(PriceCurrencyEnum).optional(),

        // Details
        roomsCount: z.number().optional(),
        maxGuests: z.number().optional(),
        averageRating: z.string().optional(),
        reviewsCount: z.number().optional(),

        // Capacity and extra information
        extraInfo: z
            .object({
                capacity: z.number().optional(),
                bedrooms: z.number().optional(),
                beds: z.number().optional(),
                bathrooms: z.number().optional()
            })
            .optional(),

        // Features
        isFeatured: z.boolean().optional(),
        amenities: z.array(z.string()).optional(),
        features: z.array(z.string()).optional(),

        // Media
        media: z
            .object({
                featuredImage: z
                    .object({
                        url: z.string().url(),
                        caption: z.string().optional(),
                        description: z.string().optional()
                    })
                    .optional(),
                gallery: z
                    .array(
                        z.object({
                            url: z.string().url(),
                            caption: z.string().optional(),
                            description: z.string().optional()
                        })
                    )
                    .optional()
            })
            .optional(),

        // Status fields
        visibility: z.nativeEnum(VisibilityEnum).optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional(),
        moderationState: z.nativeEnum(ModerationStatusEnum).optional(),

        // Timestamps
        createdAt: z.string().optional(),
        updatedAt: z.string().optional()
    })
    .passthrough();

/**
 * Schema for accommodation editing
 */
export const AccommodationEditSchema = z
    .object({
        // Basic Information
        name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
        summary: z.string().min(1, 'Summary is required').max(500, 'Summary too long'),
        description: z.string().min(1, 'Description is required'),
        type: z.nativeEnum(AccommodationTypeEnum, {
            required_error: 'Accommodation type is required'
        }),

        // Ownership & Location
        destinationId: z.string().min(1, 'Destination is required'),
        ownerId: z.string().min(1, 'Owner is required'),

        // Capacity (nested in extraInfo)
        extraInfo: z
            .object({
                capacity: z.number().min(1, 'Must accommodate at least 1 guest').optional(),
                bedrooms: z.number().min(0, 'Bedrooms cannot be negative').optional(),
                beds: z.number().min(0, 'Beds cannot be negative').optional(),
                bathrooms: z.number().min(0, 'Bathrooms cannot be negative').optional()
            })
            .optional(),

        // Status & Settings
        isFeatured: z.boolean().optional(),
        visibility: z.nativeEnum(VisibilityEnum).optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional()
    })
    .strict();

export type AccommodationDetail = z.infer<typeof AccommodationDetailSchema>;
export type AccommodationEdit = z.infer<typeof AccommodationEditSchema>;
