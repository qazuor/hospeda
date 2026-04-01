import { z } from 'zod';
import { SponsorshipIdSchema } from '../../common/id.schema.js';
import {
    SponsorshipCreateInputSchema,
    SponsorshipSchema,
    SponsorshipUpdateInputSchema
} from './sponsorship.schema.js';

/**
 * Sponsorship CRUD Schemas
 *
 * Dedicated CRUD operation schemas for sponsorships.
 * Create / Update schemas are re-exported from the base schema for consistency.
 * Delete and Restore schemas are defined here.
 */

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new sponsorship.
 * Re-exported from base schema — slug is optional (auto-generated if absent).
 */
export { SponsorshipCreateInputSchema };
export type { SponsorshipCreateInput } from './sponsorship.schema.js';

/**
 * Schema for sponsorship creation response.
 * Returns the complete sponsorship object.
 */
export const SponsorshipCreateOutputSchema = SponsorshipSchema;
export type SponsorshipCreateOutput = z.infer<typeof SponsorshipCreateOutputSchema>;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating a sponsorship (PUT / PATCH — all fields optional).
 * Re-exported from base schema.
 */
export { SponsorshipUpdateInputSchema };
export type { SponsorshipUpdateInput } from './sponsorship.schema.js';

/**
 * Schema for partial sponsorship updates (PATCH).
 * Same as update but explicitly named for clarity.
 */
export const SponsorshipPatchInputSchema = SponsorshipUpdateInputSchema;
export type SponsorshipPatchInput = z.infer<typeof SponsorshipPatchInputSchema>;

/**
 * Schema for sponsorship update response.
 * Returns the complete updated sponsorship object.
 */
export const SponsorshipUpdateOutputSchema = SponsorshipSchema;
export type SponsorshipUpdateOutput = z.infer<typeof SponsorshipUpdateOutputSchema>;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for sponsorship deletion input.
 * Requires the sponsorship ID; optional force flag for hard delete.
 */
export const SponsorshipDeleteInputSchema = z.object({
    id: SponsorshipIdSchema,
    force: z
        .boolean({
            message: 'zodError.sponsorship.delete.force.invalidType'
        })
        .optional()
        .default(false)
});
export type SponsorshipDeleteInput = z.infer<typeof SponsorshipDeleteInputSchema>;

/**
 * Schema for sponsorship deletion response.
 * Returns success status and deletion timestamp.
 */
export const SponsorshipDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.sponsorship.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.sponsorship.delete.deletedAt.invalidType'
        })
        .optional()
});
export type SponsorshipDeleteOutput = z.infer<typeof SponsorshipDeleteOutputSchema>;

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for sponsorship restoration input.
 * Requires only the sponsorship ID.
 */
export const SponsorshipRestoreInputSchema = z.object({
    id: SponsorshipIdSchema
});
export type SponsorshipRestoreInput = z.infer<typeof SponsorshipRestoreInputSchema>;

/**
 * Schema for sponsorship restoration response.
 * Returns the complete restored sponsorship object.
 */
export const SponsorshipRestoreOutputSchema = SponsorshipSchema;
export type SponsorshipRestoreOutput = z.infer<typeof SponsorshipRestoreOutputSchema>;
