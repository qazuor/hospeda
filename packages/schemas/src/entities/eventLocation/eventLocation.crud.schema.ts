import { z } from 'zod';
import { EventLocationIdSchema } from '../../common/id.schema.js';
import { EventLocationSchema } from './eventLocation.schema.js';

/**
 * EventLocation CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for event locations:
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
 * Schema for creating a new event location
 * Omits auto-generated fields like id and audit fields
 */
export const EventLocationCreateInputSchema = EventLocationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).strict();

/**
 * Schema for event location creation response
 * Returns the complete event location object
 */
export const EventLocationCreateOutputSchema = EventLocationSchema;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating an event location (PUT - complete replacement)
 * Omits auto-generated fields and makes all fields partial
 */
export const EventLocationUpdateInputSchema = EventLocationSchema.omit({
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
 * Schema for partial event location updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const EventLocationPatchInputSchema = EventLocationUpdateInputSchema;

/**
 * Schema for event location update response
 * Returns the complete updated event location object
 */
export const EventLocationUpdateOutputSchema = EventLocationSchema;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for event location deletion input
 * Requires ID and optional force flag for hard delete
 */
export const EventLocationDeleteInputSchema = z.object({
    id: EventLocationIdSchema,
    force: z
        .boolean({
            message: 'zodError.eventLocation.delete.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for event location deletion response
 * Returns success status and deletion timestamp
 */
export const EventLocationDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.eventLocation.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.eventLocation.delete.deletedAt.invalidType'
        })
        .optional()
});

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for event location restoration input
 * Requires only the event location ID
 */
export const EventLocationRestoreInputSchema = z.object({
    id: EventLocationIdSchema
});

/**
 * Schema for event location restoration response
 * Returns the complete restored event location object
 */
export const EventLocationRestoreOutputSchema = EventLocationSchema;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type EventLocationCreateInput = z.infer<typeof EventLocationCreateInputSchema>;
export type EventLocationCreateOutput = z.infer<typeof EventLocationCreateOutputSchema>;
export type EventLocationUpdateInput = z.infer<typeof EventLocationUpdateInputSchema>;
export type EventLocationPatchInput = z.infer<typeof EventLocationPatchInputSchema>;
export type EventLocationUpdateOutput = z.infer<typeof EventLocationUpdateOutputSchema>;
export type EventLocationDeleteInput = z.infer<typeof EventLocationDeleteInputSchema>;
export type EventLocationDeleteOutput = z.infer<typeof EventLocationDeleteOutputSchema>;
export type EventLocationRestoreInput = z.infer<typeof EventLocationRestoreInputSchema>;
export type EventLocationRestoreOutput = z.infer<typeof EventLocationRestoreOutputSchema>;
