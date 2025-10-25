import { z } from 'zod';
import { ClientSchema } from './client.schema.js';

/**
 * Client CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for clients:
 * - Create (input/output)
 * - Update (input/output)
 * - Delete (input/output)
 * - Restore (input/output)
 */

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new client
 * Omits auto-generated fields like id and audit fields
 */
export const ClientCreateInputSchema = ClientSchema.omit({
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
export type ClientCreateInput = z.infer<typeof ClientCreateInputSchema>;

/**
 * Schema for client creation response
 * Returns the complete client object
 */
export const ClientCreateOutputSchema = ClientSchema;

// Type: Create Output
export type ClientCreateOutput = z.infer<typeof ClientCreateOutputSchema>;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating an existing client
 * All fields are optional except id constraints
 */
export const ClientUpdateInputSchema = ClientCreateInputSchema.partial();

// Type: Update Input
export type ClientUpdateInput = z.infer<typeof ClientUpdateInputSchema>;

/**
 * Schema for client update response
 * Returns the complete updated client object
 */
export const ClientUpdateOutputSchema = ClientSchema;

// Type: Update Output
export type ClientUpdateOutput = z.infer<typeof ClientUpdateOutputSchema>;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for soft deleting a client
 * No additional input required beyond the ID (handled in route)
 */
export const ClientDeleteInputSchema = z.object({});

// Type: Delete Input
export type ClientDeleteInput = z.infer<typeof ClientDeleteInputSchema>;

/**
 * Schema for client deletion response
 * Returns success status and deletion timestamp
 */
export const ClientDeleteOutputSchema = z.object({
    success: z.boolean().default(true),
    deletedAt: z.date().optional()
});

// Type: Delete Output
export type ClientDeleteOutput = z.infer<typeof ClientDeleteOutputSchema>;

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for restoring a soft-deleted client
 * No additional input required beyond the ID (handled in route)
 */
export const ClientRestoreInputSchema = z.object({});

// Type: Restore Input
export type ClientRestoreInput = z.infer<typeof ClientRestoreInputSchema>;

/**
 * Schema for client restoration response
 * Returns the complete restored client object
 */
export const ClientRestoreOutputSchema = ClientSchema;

// Type: Restore Output
export type ClientRestoreOutput = z.infer<typeof ClientRestoreOutputSchema>;
