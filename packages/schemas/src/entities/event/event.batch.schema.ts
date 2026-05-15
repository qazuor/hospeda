import { z } from 'zod';
import { EventAdminSchema } from './event.access.schema';
import { EventSchema } from './event.schema';

/**
 * Batch request schema for event operations
 * Used for retrieving multiple events by their IDs
 *
 * @example
 * ```typescript
 * const request = {
 *   ids: ['evt_123', 'evt_456', 'evt_789'],
 *   fields: ['id', 'name', 'description'] // Optional field selection
 * };
 * ```
 */
export const EventBatchRequestSchema = z.object({
    /**
     * Array of event IDs to retrieve
     * Limited to 100 IDs per request for performance
     */
    ids: z
        .array(z.string().uuid('Invalid event ID format'))
        .min(1, 'At least one event ID is required')
        .max(100, 'Maximum 100 event IDs allowed per request'),

    /**
     * Optional array of field names to include in the response
     * If not provided, all fields will be returned
     * Always includes 'id' and 'name' for entity selectors to work
     */
    fields: z.array(z.string().min(1, 'Field name cannot be empty')).optional()
});

/**
 * Batch response schema for event operations
 * Returns an array of events or null for not found items
 *
 * @example
 * ```typescript
 * const response = [
 *   { id: 'evt_123', name: 'Music Festival', ... },
 *   null, // evt_456 not found
 *   { id: 'evt_789', name: 'Art Exhibition', ... }
 * ];
 * ```
 */
/**
 * Public batch item schema for event operations
 * All fields are optional except `id` (the handler always emits it).
 */
export const EventBatchItemSchema = EventSchema.partial().required({ id: true });

export const EventBatchResponseSchema = z.array(EventBatchItemSchema.nullable());

/**
 * Admin batch item schema for event operations
 * Same partial shape over the admin projection (includes admin-only fields).
 */
export const EventAdminBatchItemSchema = EventAdminSchema.partial().required({ id: true });

export const EventAdminBatchResponseSchema = z.array(EventAdminBatchItemSchema.nullable());

/**
 * Type definitions for batch operations
 */
export type EventBatchRequest = z.infer<typeof EventBatchRequestSchema>;
export type EventBatchItem = z.infer<typeof EventBatchItemSchema>;
export type EventBatchResponse = z.infer<typeof EventBatchResponseSchema>;
export type EventAdminBatchItem = z.infer<typeof EventAdminBatchItemSchema>;
export type EventAdminBatchResponse = z.infer<typeof EventAdminBatchResponseSchema>;
