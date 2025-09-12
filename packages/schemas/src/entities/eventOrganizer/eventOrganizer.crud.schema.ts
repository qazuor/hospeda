import { z } from 'zod';
import { EventOrganizerIdSchema } from '../../common/id.schema.js';
import { DeleteResultSchema, RestoreResultSchema } from '../../common/result.schema.js';
import { EventOrganizerSchema } from './eventOrganizer.schema.js';

/**
 * EventOrganizer CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for event organizers:
 * - Create (input/output)
 * - Update (input/output)
 * - Delete (input/output)
 * - Restore (input/output)
 */

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new event organizer
 * Omits auto-generated fields like id and audit fields
 */
export const EventOrganizerCreateInputSchema = EventOrganizerSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).strict();

/**
 * Schema for event organizer creation response
 * Returns the complete event organizer object
 */
export const EventOrganizerCreateOutputSchema = EventOrganizerSchema;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating an event organizer (PUT - complete replacement)
 * Omits auto-generated fields and makes all fields partial
 */
export const EventOrganizerUpdateInputSchema = EventOrganizerSchema.omit({
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
 * Schema for partial event organizer updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const EventOrganizerPatchInputSchema = EventOrganizerUpdateInputSchema;

/**
 * Schema for event organizer update response
 * Returns the complete updated event organizer object
 */
export const EventOrganizerUpdateOutputSchema = EventOrganizerSchema;

/**
 * Schema for event organizer view response
 * Returns the complete event organizer object for read operations
 */
export const EventOrganizerViewOutputSchema = EventOrganizerSchema;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for deleting an event organizer
 * Requires ID and optional force flag for hard delete
 */
export const EventOrganizerDeleteInputSchema = z.object({
    id: EventOrganizerIdSchema,
    force: z
        .boolean({
            message: 'zodError.eventOrganizer.delete.force.invalidType'
        })
        .default(false)
        .optional()
});

/**
 * Schema for event organizer deletion response
 * Returns success status and optional deletion timestamp
 */
export const EventOrganizerDeleteOutputSchema = DeleteResultSchema;

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for restoring a soft-deleted event organizer
 * Requires only the ID
 */
export const EventOrganizerRestoreInputSchema = z.object({
    id: EventOrganizerIdSchema
});

/**
 * Schema for event organizer restoration response
 * Returns success status and optional restoration timestamp
 */
export const EventOrganizerRestoreOutputSchema = RestoreResultSchema;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type EventOrganizerCreateInput = z.infer<typeof EventOrganizerCreateInputSchema>;
export type EventOrganizerCreateOutput = z.infer<typeof EventOrganizerCreateOutputSchema>;
export type EventOrganizerUpdateInput = z.infer<typeof EventOrganizerUpdateInputSchema>;
export type EventOrganizerPatchInput = z.infer<typeof EventOrganizerPatchInputSchema>;
export type EventOrganizerUpdateOutput = z.infer<typeof EventOrganizerUpdateOutputSchema>;
export type EventOrganizerViewOutput = z.infer<typeof EventOrganizerViewOutputSchema>;
export type EventOrganizerDeleteInput = z.infer<typeof EventOrganizerDeleteInputSchema>;
export type EventOrganizerDeleteOutput = z.infer<typeof EventOrganizerDeleteOutputSchema>;
export type EventOrganizerRestoreInput = z.infer<typeof EventOrganizerRestoreInputSchema>;
export type EventOrganizerRestoreOutput = z.infer<typeof EventOrganizerRestoreOutputSchema>;
