import { DestinationExtensionSchema, OwnerExtensionSchema } from '@/shared/schemas';
import {
    AccommodationSchema,
    AccommodationListItemSchema as BaseAccommodationListItemSchema,
    createAverageRatingField
} from '@repo/schemas';
import type { z } from 'zod';

// Re-export base schema from @repo/schemas
export { AccommodationSchema };

/**
 * Extended accommodation list item schema for admin compatibility
 *
 * Extensions:
 * - destination: Uses DestinationExtensionSchema for consistency
 * - owner: Uses OwnerExtensionSchema for consistency
 */
export const AccommodationListItemSchema = BaseAccommodationListItemSchema.extend(
    DestinationExtensionSchema.shape
)
    .extend(OwnerExtensionSchema.shape)
    .extend({
        // Proper averageRating field handling for database numeric values
        averageRating: createAverageRatingField({ optional: true })
    });

/**
 * Type for accommodation list items with admin extensions
 */
export type Accommodation = z.infer<typeof AccommodationListItemSchema>;
