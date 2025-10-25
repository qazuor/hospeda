import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { AccommodationListingPlanIdSchema } from '../../common/id.schema.js';

/**
 * AccommodationListingPlan Schema - Main Entity Schema
 *
 * This schema defines the complete structure of an AccommodationListingPlan entity
 * using base field objects for consistency and maintainability.
 *
 * Represents a plan that defines limits and features for accommodation listings
 */
export const AccommodationListingPlanSchema = z.object({
    // Base fields
    id: AccommodationListingPlanIdSchema,
    ...BaseAuditFields,

    // Plan information
    name: z
        .string()
        .min(3, { message: 'zodError.accommodationListingPlan.name.min' })
        .max(100, { message: 'zodError.accommodationListingPlan.name.max' }),

    // Plan limits and features (flexible JSON structure)
    limits: z.record(z.string(), z.unknown()).optional(),

    // Base admin fields
    ...BaseAdminFields
});

export type AccommodationListingPlan = z.infer<typeof AccommodationListingPlanSchema>;
