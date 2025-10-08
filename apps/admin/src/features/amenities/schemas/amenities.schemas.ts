import type { AmenityListItem } from '@repo/schemas';
import { AmenityWithAccommodationCountSchema as BaseAmenityListItemSchema } from '@repo/schemas';

/**
 * Schema for amenity list items in admin
 * Uses AmenityWithAccommodationCountSchema from @repo/schemas
 */
export const AmenityListItemSchema = BaseAmenityListItemSchema;

export type Amenity = AmenityListItem & {
    accommodationCount?: number;
};
