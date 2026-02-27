import { DestinationExtensionSchema, OwnerExtensionSchema } from '@/shared/schemas';
import {
    AccommodationSchema,
    AccommodationListItemSchema as BaseAccommodationListItemSchema,
    LifecycleStatusEnumSchema,
    ModerationStatusEnumSchema,
    VisibilityEnumSchema,
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
 * - visibility, lifecycleState, moderationState: Admin-only status fields (BUG-005)
 */
export const AccommodationListItemSchema = BaseAccommodationListItemSchema.extend(
    DestinationExtensionSchema.shape
)
    .extend(OwnerExtensionSchema.shape)
    .extend({
        // Proper averageRating field handling for database numeric values
        averageRating: createAverageRatingField({ optional: true }),
        // Admin status fields not included in public list schema
        visibility: VisibilityEnumSchema.optional(),
        lifecycleState: LifecycleStatusEnumSchema.optional(),
        moderationState: ModerationStatusEnumSchema.optional()
    });

/**
 * Type for accommodation list items with admin extensions
 */
export type Accommodation = z.infer<typeof AccommodationListItemSchema>;
