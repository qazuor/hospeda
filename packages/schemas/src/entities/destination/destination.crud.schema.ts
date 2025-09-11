import { z } from 'zod';
import { DestinationIdSchema } from '../../common/id.schema.js';
import { DestinationSchema } from './destination.schema.js';

/**
 * Destination CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for destinations:
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
 * Schema for creating a new destination
 * Omits auto-generated fields like id and audit fields
 */
export const DestinationCreateInputSchema = DestinationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Schema for destination creation response
 * Returns the complete destination object
 */
export const DestinationCreateOutputSchema = DestinationSchema;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating a destination (PUT - complete replacement)
 * Omits auto-generated fields and makes all fields partial
 */
export const DestinationUpdateInputSchema = DestinationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
})
    .partial()
    .strict();

/**
 * Schema for partial destination updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const DestinationPatchInputSchema = DestinationUpdateInputSchema;

/**
 * Schema for destination update response
 * Returns the complete updated destination object
 */
export const DestinationUpdateOutputSchema = DestinationSchema;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for destination deletion input
 * Requires ID and optional force flag for hard delete
 */
export const DestinationDeleteInputSchema = z.object({
    id: DestinationIdSchema,
    force: z
        .boolean({
            message: 'zodError.destination.delete.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for destination deletion response
 * Returns success status and deletion timestamp
 */
export const DestinationDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.destination.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.destination.delete.deletedAt.invalidType'
        })
        .optional()
});

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for destination restoration input
 * Requires only the destination ID
 */
export const DestinationRestoreInputSchema = z.object({
    id: DestinationIdSchema
});

/**
 * Schema for destination restoration response
 * Returns the complete restored destination object
 */
export const DestinationRestoreOutputSchema = DestinationSchema;

// ============================================================================
// FEATURE TOGGLE SCHEMAS
// ============================================================================

/**
 * Schema for destination feature toggle input
 * Requires destination ID and feature status
 */
export const DestinationFeatureToggleInputSchema = z.object({
    id: DestinationIdSchema,
    isFeatured: z.boolean({
        message: 'zodError.destination.featureToggle.isFeatured.required'
    })
});

/**
 * Schema for destination feature toggle response
 * Returns the updated destination object
 */
export const DestinationFeatureToggleOutputSchema = DestinationSchema;

// ============================================================================
// BULK OPERATIONS SCHEMAS
// ============================================================================

/**
 * Schema for bulk destination operations input
 * Requires array of destination IDs and operation type
 */
export const DestinationBulkOperationInputSchema = z.object({
    ids: z
        .array(DestinationIdSchema, {
            message: 'zodError.destination.bulkOperation.ids.required'
        })
        .min(1, { message: 'zodError.destination.bulkOperation.ids.min' })
        .max(100, { message: 'zodError.destination.bulkOperation.ids.max' }),
    operation: z.enum(['delete', 'restore', 'feature', 'unfeature'], {
        message: 'zodError.destination.bulkOperation.operation.enum'
    }),
    force: z
        .boolean({
            message: 'zodError.destination.bulkOperation.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for bulk destination operations response
 * Returns operation results for each destination
 */
export const DestinationBulkOperationOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.destination.bulkOperation.success.required'
        })
        .default(true),
    results: z.array(
        z.object({
            id: DestinationIdSchema,
            success: z.boolean(),
            error: z.string().optional()
        })
    ),
    summary: z.object({
        total: z.number().int().min(0),
        successful: z.number().int().min(0),
        failed: z.number().int().min(0)
    })
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type DestinationCreateInput = z.infer<typeof DestinationCreateInputSchema>;
export type DestinationCreateOutput = z.infer<typeof DestinationCreateOutputSchema>;
export type DestinationUpdateInput = z.infer<typeof DestinationUpdateInputSchema>;
export type DestinationPatchInput = z.infer<typeof DestinationPatchInputSchema>;
export type DestinationUpdateOutput = z.infer<typeof DestinationUpdateOutputSchema>;
export type DestinationDeleteInput = z.infer<typeof DestinationDeleteInputSchema>;
export type DestinationDeleteOutput = z.infer<typeof DestinationDeleteOutputSchema>;
export type DestinationRestoreInput = z.infer<typeof DestinationRestoreInputSchema>;
export type DestinationRestoreOutput = z.infer<typeof DestinationRestoreOutputSchema>;
export type DestinationFeatureToggleInput = z.infer<typeof DestinationFeatureToggleInputSchema>;
export type DestinationFeatureToggleOutput = z.infer<typeof DestinationFeatureToggleOutputSchema>;
export type DestinationBulkOperationInput = z.infer<typeof DestinationBulkOperationInputSchema>;
export type DestinationBulkOperationOutput = z.infer<typeof DestinationBulkOperationOutputSchema>;
