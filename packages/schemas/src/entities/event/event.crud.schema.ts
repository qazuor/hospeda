import { z } from 'zod';
import { EventIdSchema } from '../../common/id.schema.js';
import { EventSchema } from './event.schema.js';

/**
 * Event CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for events:
 * - Create (input/output)
 * - Update (input/output)
 * - Patch (input)
 * - Delete (input/output)
 * - Restore (input/output)
 * - Publish/Unpublish (input/output)
 */

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new event
 * Omits auto-generated fields like id and audit fields
 */
export const EventCreateInputSchema = EventSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Schema for event creation response
 * Returns the complete event object
 */
export const EventCreateOutputSchema = EventSchema;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating an event (PUT - complete replacement)
 * Omits auto-generated fields and makes all fields partial
 */
export const EventUpdateInputSchema = EventSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).partial();

/**
 * Schema for partial event updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const EventPatchInputSchema = EventUpdateInputSchema;

/**
 * Schema for event update response
 * Returns the complete updated event object
 */
export const EventUpdateOutputSchema = EventSchema;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for event deletion input
 * Requires ID and optional force flag for hard delete
 */
export const EventDeleteInputSchema = z.object({
    id: EventIdSchema,
    force: z
        .boolean({
            message: 'zodError.event.delete.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for event deletion response
 * Returns success status and deletion timestamp
 */
export const EventDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.event.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.event.delete.deletedAt.invalidType'
        })
        .optional()
});

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for event restoration input
 * Requires only the event ID
 */
export const EventRestoreInputSchema = z.object({
    id: EventIdSchema
});

/**
 * Schema for event restoration response
 * Returns the complete restored event object
 */
export const EventRestoreOutputSchema = EventSchema;

// ============================================================================
// PUBLISH/UNPUBLISH SCHEMAS
// ============================================================================

/**
 * Schema for event publish input
 * Requires event ID and optional publish date
 */
export const EventPublishInputSchema = z.object({
    id: EventIdSchema,
    publishedAt: z
        .date({
            message: 'zodError.event.publish.publishedAt.invalidType'
        })
        .optional()
});

/**
 * Schema for event unpublish input
 * Requires only the event ID
 */
export const EventUnpublishInputSchema = z.object({
    id: EventIdSchema
});

/**
 * Schema for event publish/unpublish response
 * Returns the updated event object
 */
export const EventPublishOutputSchema = EventSchema;

// ============================================================================
// FEATURE TOGGLE SCHEMAS
// ============================================================================

/**
 * Schema for event feature toggle input
 * Requires event ID and feature status
 */
export const EventFeatureToggleInputSchema = z.object({
    id: EventIdSchema,
    isFeatured: z.boolean({
        message: 'zodError.event.featureToggle.isFeatured.required'
    })
});

/**
 * Schema for event feature toggle response
 * Returns the updated event object
 */
export const EventFeatureToggleOutputSchema = EventSchema;

// ============================================================================
// CANCEL/RESCHEDULE SCHEMAS
// ============================================================================

/**
 * Schema for event cancellation input
 * Requires event ID and optional cancellation reason
 */
export const EventCancelInputSchema = z.object({
    id: EventIdSchema,
    cancellationReason: z
        .string({
            message: 'zodError.event.cancel.cancellationReason.invalidType'
        })
        .min(1, { message: 'zodError.event.cancel.cancellationReason.min' })
        .max(500, { message: 'zodError.event.cancel.cancellationReason.max' })
        .optional(),
    notifyAttendees: z
        .boolean({
            message: 'zodError.event.cancel.notifyAttendees.invalidType'
        })
        .optional()
        .default(true)
});

/**
 * Schema for event reschedule input
 * Requires event ID and new dates
 */
export const EventRescheduleInputSchema = z.object({
    id: EventIdSchema,
    newStartDate: z.date({
        message: 'zodError.event.reschedule.newStartDate.required'
    }),
    newEndDate: z
        .date({
            message: 'zodError.event.reschedule.newEndDate.invalidType'
        })
        .optional(),
    rescheduleReason: z
        .string({
            message: 'zodError.event.reschedule.rescheduleReason.invalidType'
        })
        .min(1, { message: 'zodError.event.reschedule.rescheduleReason.min' })
        .max(500, { message: 'zodError.event.reschedule.rescheduleReason.max' })
        .optional(),
    notifyAttendees: z
        .boolean({
            message: 'zodError.event.reschedule.notifyAttendees.invalidType'
        })
        .optional()
        .default(true)
});

/**
 * Schema for event cancel/reschedule response
 * Returns the updated event object
 */
export const EventCancelRescheduleOutputSchema = EventSchema;

// ============================================================================
// DUPLICATE SCHEMAS
// ============================================================================

/**
 * Schema for event duplication input
 * Requires event ID and optional new details
 */
export const EventDuplicateInputSchema = z.object({
    id: EventIdSchema,
    name: z
        .string({
            message: 'zodError.event.duplicate.name.invalidType'
        })
        .min(1, { message: 'zodError.event.duplicate.name.min' })
        .max(200, { message: 'zodError.event.duplicate.name.max' })
        .optional(),
    slug: z
        .string({
            message: 'zodError.event.duplicate.slug.invalidType'
        })
        .min(1, { message: 'zodError.event.duplicate.slug.min' })
        .max(200, { message: 'zodError.event.duplicate.slug.max' })
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'zodError.event.duplicate.slug.pattern'
        })
        .optional(),
    startDate: z
        .date({
            message: 'zodError.event.duplicate.startDate.invalidType'
        })
        .optional(),
    endDate: z
        .date({
            message: 'zodError.event.duplicate.endDate.invalidType'
        })
        .optional(),
    isDraft: z
        .boolean({
            message: 'zodError.event.duplicate.isDraft.invalidType'
        })
        .optional()
        .default(true)
});

/**
 * Schema for event duplication response
 * Returns the new duplicated event object
 */
export const EventDuplicateOutputSchema = EventSchema;

// ============================================================================
// BULK OPERATIONS SCHEMAS
// ============================================================================

/**
 * Schema for bulk event operations input
 * Requires array of event IDs and operation type
 */
export const EventBulkOperationInputSchema = z.object({
    ids: z
        .array(EventIdSchema, {
            message: 'zodError.event.bulkOperation.ids.required'
        })
        .min(1, { message: 'zodError.event.bulkOperation.ids.min' })
        .max(100, { message: 'zodError.event.bulkOperation.ids.max' }),
    operation: z.enum(
        ['delete', 'restore', 'publish', 'unpublish', 'feature', 'unfeature', 'cancel'],
        {
            message: 'zodError.event.bulkOperation.operation.enum'
        }
    ),
    force: z
        .boolean({
            message: 'zodError.event.bulkOperation.force.invalidType'
        })
        .optional()
        .default(false),
    publishedAt: z
        .date({
            message: 'zodError.event.bulkOperation.publishedAt.invalidType'
        })
        .optional(),
    cancellationReason: z
        .string({
            message: 'zodError.event.bulkOperation.cancellationReason.invalidType'
        })
        .min(1, { message: 'zodError.event.bulkOperation.cancellationReason.min' })
        .max(500, { message: 'zodError.event.bulkOperation.cancellationReason.max' })
        .optional(),
    notifyAttendees: z
        .boolean({
            message: 'zodError.event.bulkOperation.notifyAttendees.invalidType'
        })
        .optional()
        .default(true)
});

/**
 * Schema for bulk event operations response
 * Returns operation results for each event
 */
export const EventBulkOperationOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.event.bulkOperation.success.required'
        })
        .default(true),
    results: z.array(
        z.object({
            id: EventIdSchema,
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

export type EventCreateInput = z.infer<typeof EventCreateInputSchema>;
export type EventCreateOutput = z.infer<typeof EventCreateOutputSchema>;
export type EventUpdateInput = z.infer<typeof EventUpdateInputSchema>;
export type EventPatchInput = z.infer<typeof EventPatchInputSchema>;
export type EventUpdateOutput = z.infer<typeof EventUpdateOutputSchema>;
export type EventDeleteInput = z.infer<typeof EventDeleteInputSchema>;
export type EventDeleteOutput = z.infer<typeof EventDeleteOutputSchema>;
export type EventRestoreInput = z.infer<typeof EventRestoreInputSchema>;
export type EventRestoreOutput = z.infer<typeof EventRestoreOutputSchema>;
export type EventPublishInput = z.infer<typeof EventPublishInputSchema>;
export type EventUnpublishInput = z.infer<typeof EventUnpublishInputSchema>;
export type EventPublishOutput = z.infer<typeof EventPublishOutputSchema>;
export type EventFeatureToggleInput = z.infer<typeof EventFeatureToggleInputSchema>;
export type EventFeatureToggleOutput = z.infer<typeof EventFeatureToggleOutputSchema>;
export type EventCancelInput = z.infer<typeof EventCancelInputSchema>;
export type EventRescheduleInput = z.infer<typeof EventRescheduleInputSchema>;
export type EventCancelRescheduleOutput = z.infer<typeof EventCancelRescheduleOutputSchema>;
export type EventDuplicateInput = z.infer<typeof EventDuplicateInputSchema>;
export type EventDuplicateOutput = z.infer<typeof EventDuplicateOutputSchema>;
export type EventBulkOperationInput = z.infer<typeof EventBulkOperationInputSchema>;
export type EventBulkOperationOutput = z.infer<typeof EventBulkOperationOutputSchema>;
