import { z } from 'zod';
import { OwnerPromotionIdSchema } from '../../common/id.schema.js';
import {
    OwnerPromotionCreateInputSchema,
    OwnerPromotionSchema,
    OwnerPromotionUpdateInputSchema
} from './owner-promotion.schema.js';

/**
 * Owner Promotion CRUD Schemas
 *
 * Dedicated CRUD operation schemas for owner promotions.
 * Create / Update schemas are re-exported from the base schema for consistency.
 * Delete and Restore schemas are defined here.
 */

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new owner promotion.
 * Re-exported from base schema — slug is optional (auto-generated if absent).
 */
export { OwnerPromotionCreateInputSchema };
export type { OwnerPromotionCreateInput } from './owner-promotion.schema.js';

/**
 * Schema for owner promotion creation response.
 * Returns the complete owner promotion object.
 */
export const OwnerPromotionCreateOutputSchema = OwnerPromotionSchema;
export type OwnerPromotionCreateOutput = z.infer<typeof OwnerPromotionCreateOutputSchema>;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating an owner promotion (PUT / PATCH — all fields optional).
 * Re-exported from base schema.
 */
export { OwnerPromotionUpdateInputSchema };
export type { OwnerPromotionUpdateInput } from './owner-promotion.schema.js';

/**
 * Schema for owner promotion update response.
 * Returns the complete updated owner promotion object.
 */
export const OwnerPromotionUpdateOutputSchema = OwnerPromotionSchema;
export type OwnerPromotionUpdateOutput = z.infer<typeof OwnerPromotionUpdateOutputSchema>;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for owner promotion deletion input.
 * Requires the promotion ID; optional force flag for hard delete.
 */
export const OwnerPromotionDeleteInputSchema = z.object({
    id: OwnerPromotionIdSchema,
    force: z
        .boolean({
            message: 'zodError.ownerPromotion.delete.force.invalidType'
        })
        .optional()
        .default(false)
});
export type OwnerPromotionDeleteInput = z.infer<typeof OwnerPromotionDeleteInputSchema>;

/**
 * Schema for owner promotion deletion response.
 * Returns success status and deletion timestamp.
 */
export const OwnerPromotionDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.ownerPromotion.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.ownerPromotion.delete.deletedAt.invalidType'
        })
        .optional()
});
export type OwnerPromotionDeleteOutput = z.infer<typeof OwnerPromotionDeleteOutputSchema>;

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for owner promotion restoration input.
 * Requires only the promotion ID.
 */
export const OwnerPromotionRestoreInputSchema = z.object({
    id: OwnerPromotionIdSchema
});
export type OwnerPromotionRestoreInput = z.infer<typeof OwnerPromotionRestoreInputSchema>;

/**
 * Schema for owner promotion restoration response.
 * Returns the complete restored owner promotion object.
 */
export const OwnerPromotionRestoreOutputSchema = OwnerPromotionSchema;
export type OwnerPromotionRestoreOutput = z.infer<typeof OwnerPromotionRestoreOutputSchema>;
