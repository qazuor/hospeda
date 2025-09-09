import type { z } from 'zod';
import { BaseFaqSchema } from '../../common/faq.schema.js';
import { AccommodationFaqIdSchema, AccommodationIdSchema } from '../../common/id.schema.js';

/**
 * Accommodation FAQ Schema - FAQ Entity belonging to an Accommodation
 *
 * This schema represents a FAQ entry that belongs to a specific accommodation.
 * The FAQ contains all its data plus the accommodation_id it belongs to.
 * Relationship: 1 Accommodation -> N FAQs (1-to-N, not N-to-N)
 */
export const AccommodationFaqSchema = BaseFaqSchema.extend({
    // Entity-specific ID
    id: AccommodationFaqIdSchema,

    // Owner relationship - this FAQ belongs to this accommodation
    accommodationId: AccommodationIdSchema
});

/**
 * Type exports for the AccommodationFaq entity
 */
export type AccommodationFaq = z.infer<typeof AccommodationFaqSchema>;
