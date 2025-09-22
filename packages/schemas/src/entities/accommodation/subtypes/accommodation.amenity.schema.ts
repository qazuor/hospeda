import { z } from 'zod';
import { BaseAuditFields } from '../../../common/audit.schema.js';
import { AccommodationIdSchema, AmenityIdSchema } from '../../../common/id.schema.js';
import { PriceSchema } from '../../../common/price.schema.js';

// Re-export the main AmenitySchema for convenience
export { AmenitySchema } from '../../amenity/amenity.schema.js';
export type { Amenity } from '../../amenity/amenity.schema.js';

/**
 * Accommodation-Amenity association schema
 * Links accommodations with their amenities and any specific pricing/conditions
 */
export const AccommodationAmenitySchema = z.object({
    // Base fields
    ...BaseAuditFields,

    // Association fields
    accommodationId: AccommodationIdSchema,
    amenityId: AmenityIdSchema,

    // Optional association-specific data
    price: PriceSchema.optional().describe('Optional additional price for this amenity'),
    isIncluded: z
        .boolean()
        .default(true)
        .describe('Whether this amenity is included in base price'),
    notes: z
        .string()
        .optional()
        .describe('Additional notes about this amenity for this accommodation'),
    isHighlighted: z
        .boolean()
        .default(false)
        .describe('Whether to highlight this amenity in listings')
});
export type AccommodationAmenity = z.infer<typeof AccommodationAmenitySchema>;
