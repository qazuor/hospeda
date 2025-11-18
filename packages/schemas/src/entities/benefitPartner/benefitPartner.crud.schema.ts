import { z } from 'zod';
import { BenefitPartnerSchema } from './benefitPartner.schema.js';

/**
 * Create Benefit Partner Schema
 *
 * Schema for creating new benefit partner entries. Excludes auto-generated fields
 * and provides sensible defaults for certain fields.
 */
export const CreateBenefitPartnerSchema = BenefitPartnerSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Update Benefit Partner Schema
 *
 * Schema for updating existing benefit partner entries. All fields are optional
 * to support partial updates, except clientId which cannot be changed.
 */
export const UpdateBenefitPartnerSchema = BenefitPartnerSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    clientId: true // Cannot update client association
}).partial();

/**
 * Delete Benefit Partner Schema
 *
 * Schema for soft-deleting benefit partner entries with optional reason and metadata.
 */
export const DeleteBenefitPartnerSchema = z.object({
    reason: z
        .string()
        .min(1, { message: 'zodError.benefitPartner.deleteReason.min' })
        .max(500, { message: 'zodError.benefitPartner.deleteReason.max' })
        .optional(),

    metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Type exports for Benefit Partner CRUD operations
 */
export type CreateBenefitPartner = z.infer<typeof CreateBenefitPartnerSchema>;
export type UpdateBenefitPartner = z.infer<typeof UpdateBenefitPartnerSchema>;
export type DeleteBenefitPartner = z.infer<typeof DeleteBenefitPartnerSchema>;
