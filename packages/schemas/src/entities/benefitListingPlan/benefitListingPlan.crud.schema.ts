import { z } from 'zod';
import { BenefitListingPlanSchema } from './benefitListingPlan.schema.js';

/**
 * Create Benefit Listing Plan Schema
 *
 * Schema for creating new benefit listing plan entries. Excludes auto-generated fields
 * and provides sensible defaults for certain fields.
 */
export const CreateBenefitListingPlanSchema = BenefitListingPlanSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Update Benefit Listing Plan Schema
 *
 * Schema for updating existing benefit listing plan entries. All fields are optional
 * to support partial updates.
 */
export const UpdateBenefitListingPlanSchema = BenefitListingPlanSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).partial();

/**
 * Delete Benefit Listing Plan Schema
 *
 * Schema for soft-deleting benefit listing plan entries with optional reason and metadata.
 */
export const DeleteBenefitListingPlanSchema = z.object({
    reason: z
        .string()
        .min(1, { message: 'zodError.benefitListingPlan.deleteReason.min' })
        .max(500, { message: 'zodError.benefitListingPlan.deleteReason.max' })
        .optional(),

    metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Type exports for Benefit Listing Plan CRUD operations
 */
export type CreateBenefitListingPlan = z.infer<typeof CreateBenefitListingPlanSchema>;
export type UpdateBenefitListingPlan = z.infer<typeof UpdateBenefitListingPlanSchema>;
export type DeleteBenefitListingPlan = z.infer<typeof DeleteBenefitListingPlanSchema>;
