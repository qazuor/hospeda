import { z } from 'zod';
import { AccommodationReviewIdSchema } from '../../common/id.schema.js';
import { AccommodationReviewSchema } from './accommodationReview.schema.js';

/**
 * Accommodation Review CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for accommodation reviews:
 * - Create (input/output)
 * - Update (input/output)
 * - Patch (input)
 * - Delete (input/output)
 * - Restore (input/output)
 */

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new accommodation review
 * Omits auto-generated fields like id and audit fields
 */
export const AccommodationReviewCreateInputSchema = AccommodationReviewSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Schema for accommodation review creation response
 * Returns the complete accommodation review object
 */
export const AccommodationReviewCreateOutputSchema = AccommodationReviewSchema;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating an accommodation review (PUT - complete replacement)
 * Omits auto-generated fields and makes all fields partial
 */
export const AccommodationReviewUpdateInputSchema = AccommodationReviewSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).partial();

/**
 * Schema for partial accommodation review updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const AccommodationReviewPatchInputSchema = AccommodationReviewUpdateInputSchema;

/**
 * Schema for accommodation review update response
 * Returns the complete updated accommodation review object
 */
export const AccommodationReviewUpdateOutputSchema = AccommodationReviewSchema;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for accommodation review deletion input
 * Requires ID and optional force flag for hard delete
 */
export const AccommodationReviewDeleteInputSchema = z.object({
    id: AccommodationReviewIdSchema,
    force: z
        .boolean({
            message: 'zodError.accommodationReview.delete.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for accommodation review deletion response
 * Returns success status and deletion timestamp
 */
export const AccommodationReviewDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.accommodationReview.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.accommodationReview.delete.deletedAt.invalidType'
        })
        .optional()
});

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for accommodation review restoration input
 * Requires only the accommodation review ID
 */
export const AccommodationReviewRestoreInputSchema = z.object({
    id: AccommodationReviewIdSchema
});

/**
 * Schema for accommodation review restoration response
 * Returns the complete restored accommodation review object
 */
export const AccommodationReviewRestoreOutputSchema = AccommodationReviewSchema;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AccommodationReviewCreateInput = z.infer<typeof AccommodationReviewCreateInputSchema>;
export type AccommodationReviewCreateOutput = z.infer<typeof AccommodationReviewCreateOutputSchema>;
export type AccommodationReviewUpdateInput = z.infer<typeof AccommodationReviewUpdateInputSchema>;
export type AccommodationReviewPatchInput = z.infer<typeof AccommodationReviewPatchInputSchema>;
export type AccommodationReviewUpdateOutput = z.infer<typeof AccommodationReviewUpdateOutputSchema>;
export type AccommodationReviewDeleteInput = z.infer<typeof AccommodationReviewDeleteInputSchema>;
export type AccommodationReviewDeleteOutput = z.infer<typeof AccommodationReviewDeleteOutputSchema>;
export type AccommodationReviewRestoreInput = z.infer<typeof AccommodationReviewRestoreInputSchema>;
export type AccommodationReviewRestoreOutput = z.infer<
    typeof AccommodationReviewRestoreOutputSchema
>;
