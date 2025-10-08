import type { LifecycleStatusEnum, ModerationStatusEnum, VisibilityEnum } from '@repo/schemas';
import {
    AccommodationSchema,
    AccommodationTypeEnum,
    AccommodationListItemSchema as BaseAccommodationListItemSchema,
    PriceCurrencyEnum
} from '@repo/schemas';
import { z } from 'zod';

// Re-export base schema from @repo/schemas
export { AccommodationSchema };

/**
 * Extended accommodation list item schema for admin compatibility
 * Extends @repo/schemas with admin-specific fields (destination, owner)
 * TODO Phase 4.2: Align API to return these fields and remove extension
 */
export const AccommodationListItemSchema = BaseAccommodationListItemSchema.extend({
    // Admin-specific relation fields that API includes but base schema doesn't
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

    // Legacy fields for backward compatibility
    destinationId: z.string().nullable().optional(),
    destinationName: z.string().optional(),
    accommodationType: z.nativeEnum(AccommodationTypeEnum).optional(),
    roomsCount: z.number().optional(),
    maxGuests: z.number().optional(),
    basePrice: z.number().optional(),
    currency: z.nativeEnum(PriceCurrencyEnum).optional(),
    amenities: z.array(z.string()).optional(),
    features: z.array(z.string()).optional()
});

/**
 * Legacy accommodation type (for backward compatibility)
 * Uses explicit typing to work around Zod version compatibility issues
 */
export type Accommodation = {
    id: string;
    slug: string;
    name: string;
    type?: AccommodationTypeEnum;
    description?: string;
    destination?: {
        id: string;
        name: string;
        slug: string;
    } | null;
    owner?: {
        id: string;
        displayName: string;
    } | null;
    price?: {
        amount?: number;
        currency?: PriceCurrencyEnum;
    } | null;
    averageRating?: number;
    reviewsCount?: number;
    isFeatured?: boolean;
    createdAt?: string;
    updatedAt?: string;
    // Legacy compatibility fields
    destinationId?: string | null;
    destinationName?: string;
    accommodationType?: AccommodationTypeEnum;
    roomsCount?: number;
    maxGuests?: number;
    basePrice?: number;
    currency?: PriceCurrencyEnum;
    amenities?: string[];
    features?: string[];
    media?: {
        featuredImage?: {
            url: string;
            caption?: string;
            description?: string;
        };
        gallery?: Array<{
            url: string;
            caption?: string;
            description?: string;
        }>;
    };
    location?: {
        latitude?: number;
        longitude?: number;
        address?: string;
    };
    ownerId?: string;
    visibility?: VisibilityEnum;
    lifecycleState?: LifecycleStatusEnum;
    moderationState?: ModerationStatusEnum;
};
