import { z } from 'zod';
import { EventOrganizerSchema } from './eventOrganizer.schema.js';

/**
 * Batch request schema for event organizer operations
 * Used for retrieving multiple event organizers by their IDs
 *
 * @example
 * ```typescript
 * const request = {
 *   ids: ['org_123', 'org_456', 'org_789'],
 *   fields: ['id', 'name', 'description'] // Optional field selection
 * };
 * ```
 */
export const EventOrganizerBatchRequestSchema = z.object({
    /**
     * Array of event organizer IDs to retrieve
     * Limited to 100 IDs per request for performance
     */
    ids: z
        .array(z.string().uuid('Invalid event organizer ID format'))
        .min(1, 'At least one event organizer ID is required')
        .max(100, 'Maximum 100 event organizer IDs allowed per request'),

    /**
     * Optional array of field names to include in the response
     * If not provided, all fields will be returned
     * Always includes 'id' and 'name' for entity selectors to work
     */
    fields: z.array(z.string().min(1, 'Field name cannot be empty')).optional()
});

/**
 * Batch response schema for event organizer operations
 * Returns an array of event organizers or null for not found items
 *
 * @example
 * ```typescript
 * const response = [
 *   { id: 'org_123', name: 'Conference Organizer', ... },
 *   null, // org_456 not found
 *   { id: 'org_789', name: 'Music Festival Team', ... }
 * ];
 * ```
 */
export const EventOrganizerBatchResponseSchema = z.array(EventOrganizerSchema.nullable());

/**
 * Type definitions for batch operations
 */
export type EventOrganizerBatchRequest = z.infer<typeof EventOrganizerBatchRequestSchema>;
export type EventOrganizerBatchResponse = z.infer<typeof EventOrganizerBatchResponseSchema>;
