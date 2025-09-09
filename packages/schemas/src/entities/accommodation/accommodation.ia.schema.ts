import type { z } from 'zod';
import { BaseIaDataSchema } from '../../common/ia.schema.js';
import { AccommodationIaDataIdSchema, AccommodationIdSchema } from '../../common/id.schema.js';

/**
 * Accommodation IA Data Schema - IA Data Entity belonging to an Accommodation
 *
 * This schema represents an IA data entry that belongs to a specific accommodation.
 * The IA Data contains all its data plus the accommodation_id it belongs to.
 * Relationship: 1 Accommodation -> N IA Data (1-to-N, not N-to-N)
 */
export const AccommodationIaDataSchema = BaseIaDataSchema.extend({
    // Entity-specific ID
    id: AccommodationIaDataIdSchema,

    // Owner relationship - this IA Data belongs to this accommodation
    accommodationId: AccommodationIdSchema
});

/**
 * Type exports for the AccommodationIaData entity
 */
export type AccommodationIaData = z.infer<typeof AccommodationIaDataSchema>;
