import { z } from 'zod';
import { ServiceListingPlanSchema } from './serviceListingPlan.schema.js';

/**
 * Create Service Listing Plan Schema
 *
 * Schema for creating new service listing plan entries. Excludes auto-generated fields
 * and provides sensible defaults for certain fields.
 */
export const CreateServiceListingPlanSchema = ServiceListingPlanSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Update Service Listing Plan Schema
 *
 * Schema for updating existing service listing plan entries. All fields are optional
 * to support partial updates.
 */
export const UpdateServiceListingPlanSchema = ServiceListingPlanSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).partial();

/**
 * Delete Service Listing Plan Schema
 *
 * Schema for soft-deleting service listing plan entries with optional reason and metadata.
 */
export const DeleteServiceListingPlanSchema = z.object({
    reason: z
        .string()
        .min(1, { message: 'zodError.serviceListingPlan.deleteReason.min' })
        .max(500, { message: 'zodError.serviceListingPlan.deleteReason.max' })
        .optional(),

    metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Type exports for Service Listing Plan CRUD operations
 */
export type CreateServiceListingPlan = z.infer<typeof CreateServiceListingPlanSchema>;
export type UpdateServiceListingPlan = z.infer<typeof UpdateServiceListingPlanSchema>;
export type DeleteServiceListingPlan = z.infer<typeof DeleteServiceListingPlanSchema>;
