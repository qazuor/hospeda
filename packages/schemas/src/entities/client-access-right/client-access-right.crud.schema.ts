import { z } from 'zod';
import { ClientAccessRightSchema } from './client-access-right.schema.js';

/**
 * ClientAccessRight CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for client access rights:
 * - Create (input/output)
 * - Update (input/output)
 * - Delete (input/output)
 * - Restore (input/output)
 */

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new client access right
 * Omits auto-generated fields like id and audit fields
 */
export const ClientAccessRightCreateInputSchema = ClientAccessRightSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    adminInfo: true
});

// Type: Create Input
export type ClientAccessRightCreateInput = z.infer<typeof ClientAccessRightCreateInputSchema>;

/**
 * Schema for client access right creation response
 * Returns the complete client access right object
 */
export const ClientAccessRightCreateOutputSchema = ClientAccessRightSchema;

// Type: Create Output
export type ClientAccessRightCreateOutput = z.infer<typeof ClientAccessRightCreateOutputSchema>;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating an existing client access right
 * All fields are optional for partial updates, excluding auto-managed fields
 */
export const ClientAccessRightUpdateInputSchema = ClientAccessRightSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    adminInfo: true
}).partial();

// Type: Update Input
export type ClientAccessRightUpdateInput = z.infer<typeof ClientAccessRightUpdateInputSchema>;

/**
 * Schema for client access right update response
 * Returns the complete updated client access right object
 */
export const ClientAccessRightUpdateOutputSchema = ClientAccessRightSchema;

// Type: Update Output
export type ClientAccessRightUpdateOutput = z.infer<typeof ClientAccessRightUpdateOutputSchema>;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for client access right deletion input
 * Contains options for soft vs hard delete
 */
export const ClientAccessRightDeleteInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    hardDelete: z
        .boolean({
            message: 'zodError.common.hardDelete.invalid'
        })
        .default(false)
        .optional(),
    reason: z
        .string({
            message: 'zodError.common.deleteReason.required'
        })
        .min(5, { message: 'zodError.common.deleteReason.min' })
        .max(500, { message: 'zodError.common.deleteReason.max' })
        .optional()
});

// Type: Delete Input
export type ClientAccessRightDeleteInput = z.infer<typeof ClientAccessRightDeleteInputSchema>;

/**
 * Schema for client access right deletion response
 * Returns basic confirmation with timestamp
 */
export const ClientAccessRightDeleteOutputSchema = z.object({
    id: z.string().uuid(),
    deletedAt: z.date(),
    hardDeleted: z.boolean(),
    message: z.string().optional()
});

// Type: Delete Output
export type ClientAccessRightDeleteOutput = z.infer<typeof ClientAccessRightDeleteOutputSchema>;

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for client access right restoration input
 * For restoring soft-deleted client access rights
 */
export const ClientAccessRightRestoreInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    reason: z
        .string({
            message: 'zodError.common.restoreReason.required'
        })
        .min(5, { message: 'zodError.common.restoreReason.min' })
        .max(500, { message: 'zodError.common.restoreReason.max' })
        .optional()
});

// Type: Restore Input
export type ClientAccessRightRestoreInput = z.infer<typeof ClientAccessRightRestoreInputSchema>;

/**
 * Schema for client access right restoration response
 * Returns the restored client access right object
 */
export const ClientAccessRightRestoreOutputSchema = ClientAccessRightSchema;

// Type: Restore Output
export type ClientAccessRightRestoreOutput = z.infer<typeof ClientAccessRightRestoreOutputSchema>;

// ============================================================================
// BULK OPERATIONS SCHEMAS
// ============================================================================

/**
 * Schema for bulk creating client access rights
 * Supports creating multiple access rights in a single operation
 */
export const ClientAccessRightBulkCreateInputSchema = z.object({
    clientAccessRights: z
        .array(ClientAccessRightCreateInputSchema)
        .min(1, { message: 'zodError.clientAccessRight.bulkCreate.min' })
        .max(100, { message: 'zodError.clientAccessRight.bulkCreate.max' }),
    skipDuplicates: z.boolean().default(false).optional(),
    continueOnError: z.boolean().default(false).optional()
});

// Type: Bulk Create Input
export type ClientAccessRightBulkCreateInput = z.infer<
    typeof ClientAccessRightBulkCreateInputSchema
>;

/**
 * Schema for bulk creation response
 */
export const ClientAccessRightBulkCreateOutputSchema = z.object({
    created: z.array(ClientAccessRightSchema),
    errors: z.array(
        z.object({
            index: z.number().int().min(0),
            error: z.string(),
            input: z.object({}).passthrough()
        })
    ),
    summary: z.object({
        total: z.number().int().min(0),
        successful: z.number().int().min(0),
        failed: z.number().int().min(0),
        skipped: z.number().int().min(0)
    })
});

// Type: Bulk Create Output
export type ClientAccessRightBulkCreateOutput = z.infer<
    typeof ClientAccessRightBulkCreateOutputSchema
>;
