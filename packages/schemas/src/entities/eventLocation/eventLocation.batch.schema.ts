import { z } from 'zod';
import { EventLocationSchema } from './eventLocation.schema.js';

/**
 * Batch request schema for event location operations
 * Used for retrieving multiple event locations by their IDs
 *
 * @example
 * ```typescript
 * const request = {
 *   ids: ['loc_123', 'loc_456', 'loc_789'],
 *   fields: ['id', 'city', 'state'] // Optional field selection
 * };
 * ```
 */
export const EventLocationBatchRequestSchema = z.object({
    /**
     * Array of event location IDs to retrieve
     * Limited to 100 IDs per request for performance
     */
    ids: z
        .array(z.string().uuid('Invalid event location ID format'))
        .min(1, 'At least one event location ID is required')
        .max(100, 'Maximum 100 event location IDs allowed per request'),

    /**
     * Optional array of field names to include in the response
     * If not provided, all fields will be returned
     * Always includes 'id' and 'city' for entity selectors to work
     */
    fields: z.array(z.string().min(1, 'Field name cannot be empty')).optional()
});

/**
 * Batch response schema for event location operations
 * Returns an array of event locations or null for not found items
 *
 * @example
 * ```typescript
 * const response = [
 *   { id: 'loc_123', city: 'Buenos Aires', ... },
 *   null, // loc_456 not found
 *   { id: 'loc_789', city: 'Córdoba', ... }
 * ];
 * ```
 */
export const EventLocationBatchResponseSchema = z.array(EventLocationSchema.nullable());

/**
 * Type definitions for batch operations
 */
export type EventLocationBatchRequest = z.infer<typeof EventLocationBatchRequestSchema>;
export type EventLocationBatchResponse = z.infer<typeof EventLocationBatchResponseSchema>;
