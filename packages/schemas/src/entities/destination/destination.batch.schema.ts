import { z } from 'zod';
import { DestinationSchema } from './destination.schema';

/**
 * Batch request schema for destination operations
 * Used for retrieving multiple destinations by their IDs
 *
 * @example
 * ```typescript
 * const request = {
 *   ids: ['dst_123', 'dst_456', 'dst_789'],
 *   fields: ['id', 'name', 'description'] // Optional field selection
 * };
 * ```
 */
export const DestinationBatchRequestSchema = z.object({
    /**
     * Array of destination IDs to retrieve
     * Limited to 100 IDs per request for performance
     */
    ids: z
        .array(z.string().uuid('Invalid destination ID format'))
        .min(1, 'At least one destination ID is required')
        .max(100, 'Maximum 100 destination IDs allowed per request'),

    /**
     * Optional array of field names to include in the response
     * If not provided, all fields will be returned
     * Always includes 'id' and 'name' for entity selectors to work
     */
    fields: z.array(z.string().min(1, 'Field name cannot be empty')).optional()
});

/**
 * Batch response schema for destination operations
 * Returns an array of destinations or null for not found items
 *
 * @example
 * ```typescript
 * const response = [
 *   { id: 'dst_123', name: 'Paris', ... },
 *   null, // dst_456 not found
 *   { id: 'dst_789', name: 'Tokyo', ... }
 * ];
 * ```
 */
export const DestinationBatchResponseSchema = z.array(DestinationSchema.nullable());

/**
 * Type definitions for batch operations
 */
export type DestinationBatchRequest = z.infer<typeof DestinationBatchRequestSchema>;
export type DestinationBatchResponse = z.infer<typeof DestinationBatchResponseSchema>;
