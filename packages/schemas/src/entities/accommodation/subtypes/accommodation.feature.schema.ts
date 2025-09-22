import { z } from 'zod';
import { BaseAuditFields } from '../../../common/audit.schema.js';
import { AccommodationIdSchema, FeatureIdSchema } from '../../../common/id.schema.js';

// Re-export the main FeatureSchema for convenience
export { FeatureSchema } from '../../feature/feature.schema.js';
export type { Feature } from '../../feature/feature.schema.js';

/**
 * Accommodation-Feature association schema
 * Links accommodations with their features
 */
export const AccommodationFeatureSchema = z.object({
    // Base fields
    ...BaseAuditFields,

    // Association fields
    accommodationId: AccommodationIdSchema,
    featureId: FeatureIdSchema,

    // Optional association-specific data
    notes: z
        .string()
        .optional()
        .describe('Additional notes about this feature for this accommodation'),
    isHighlighted: z
        .boolean()
        .default(false)
        .describe('Whether to highlight this feature in listings')
});
export type AccommodationFeature = z.infer<typeof AccommodationFeatureSchema>;
