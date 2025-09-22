import { z } from 'zod';
import { AccommodationIdSchema } from '../../common/id.schema.js';
import { AccommodationSchema } from './accommodation.schema.js';

/**
 * Accommodation CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for accommodations:
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
 * Schema for creating a new accommodation
 * Omits auto-generated fields like id and audit fields
 */
export const AccommodationCreateInputSchema = AccommodationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

// Type: Create Input
export type AccommodationCreateInput = z.infer<typeof AccommodationCreateInputSchema>;

/**
 * Schema for accommodation creation response
 * Returns the complete accommodation object
 */
export const AccommodationCreateOutputSchema = AccommodationSchema;

// Type: Create Output
export type AccommodationCreateOutput = z.infer<typeof AccommodationCreateOutputSchema>;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating an accommodation (PUT - complete replacement)
 * Omits auto-generated fields and makes all fields partial
 */
export const AccommodationUpdateInputSchema = AccommodationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).partial();

// Type: Update Input
export type AccommodationUpdateInput = z.infer<typeof AccommodationUpdateInputSchema>;

/**
 * Schema for partial accommodation updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const AccommodationPatchInputSchema = AccommodationUpdateInputSchema;

// Type: Patch Input
export type AccommodationPatchInput = z.infer<typeof AccommodationPatchInputSchema>;

/**
 * Schema for accommodation update response
 * Returns the complete updated accommodation object
 */
export const AccommodationUpdateOutputSchema = AccommodationSchema;

// Type: Update Output
export type AccommodationUpdateOutput = z.infer<typeof AccommodationUpdateOutputSchema>;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for accommodation deletion input
 * Requires ID and optional force flag for hard delete
 */
export const AccommodationDeleteInputSchema = z.object({
    id: AccommodationIdSchema,
    force: z
        .boolean({
            message: 'zodError.accommodation.delete.force.invalidType'
        })
        .optional()
        .default(false)
});

// Type: Delete Input
export type AccommodationDeleteInput = z.infer<typeof AccommodationDeleteInputSchema>;

/**
 * Schema for accommodation deletion response
 * Returns success status and deletion timestamp
 */
export const AccommodationDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.accommodation.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.accommodation.delete.deletedAt.invalidType'
        })
        .optional()
});

// Type: Delete Output
export type AccommodationDeleteOutput = z.infer<typeof AccommodationDeleteOutputSchema>;

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for accommodation restoration input
 * Requires only the accommodation ID
 */
export const AccommodationRestoreInputSchema = z.object({
    id: AccommodationIdSchema
});

// Type: Restore Input
export type AccommodationRestoreInput = z.infer<typeof AccommodationRestoreInputSchema>;

/**
 * Schema for accommodation restoration response
 * Returns the complete restored accommodation object
 */
export const AccommodationRestoreOutputSchema = AccommodationSchema;

// Type: Restore Output
export type AccommodationRestoreOutput = z.infer<typeof AccommodationRestoreOutputSchema>;
