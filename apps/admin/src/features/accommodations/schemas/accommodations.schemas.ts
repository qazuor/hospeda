import {
    AccommodationTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PriceCurrencyEnum,
    VisibilityEnum
} from '@repo/schemas';
import { z } from 'zod';

/**
 * Schema for accommodation list items
 */
export const AccommodationListItemSchema = z
    .object({
        id: z.string(),
        slug: z.string(),
        name: z.string(),
        type: z.nativeEnum(AccommodationTypeEnum).optional(),
        destination: z
            .object({
                id: z.string(),
                name: z.string(),
                slug: z.string()
            })
            .nullable()
            .optional(),
        owner: z
            .object({
                id: z.string(),
                displayName: z.string()
            })
            .nullable()
            .optional(),
        price: z
            .object({
                amount: z.number().optional(),
                currency: z.nativeEnum(PriceCurrencyEnum).optional()
            })
            .nullable()
            .optional(),
        averageRating: z.string().optional(),
        reviewsCount: z.number().optional(),
        isFeatured: z.boolean().optional(),
        visibility: z.nativeEnum(VisibilityEnum).optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional(),
        moderationState: z.nativeEnum(ModerationStatusEnum).optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
        // Legacy fields for backward compatibility
        description: z.string().optional(),
        destinationId: z.string().nullable().optional(),
        destinationName: z.string().optional(),
        accommodationType: z.nativeEnum(AccommodationTypeEnum).optional(),
        roomsCount: z.number().optional(),
        maxGuests: z.number().optional(),
        basePrice: z.number().optional(),
        currency: z.nativeEnum(PriceCurrencyEnum).optional(),
        amenities: z.array(z.string()).optional(),
        features: z.array(z.string()).optional(),
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
            .optional()
    })
    .passthrough();

export type Accommodation = z.infer<typeof AccommodationListItemSchema>;
