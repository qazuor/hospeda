import {
    AmenityWithAccommodationCountSchema as BaseAmenityListItemSchema,
    LifecycleStatusEnumSchema,
    ModerationStatusEnumSchema,
    VisibilityEnumSchema
} from '@repo/schemas';
import type { z } from 'zod';

/**
 * Schema for amenity list items in admin
 * Extends base schema with admin-only status fields (BUG-005)
 */
export const AmenityListItemSchema = BaseAmenityListItemSchema.extend({
    visibility: VisibilityEnumSchema.optional(),
    lifecycleState: LifecycleStatusEnumSchema.optional(),
    moderationState: ModerationStatusEnumSchema.optional()
});

export type Amenity = z.infer<typeof AmenityListItemSchema>;
