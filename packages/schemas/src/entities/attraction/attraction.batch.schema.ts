import { z } from 'zod';
import { AttractionSchema } from './attraction.schema';

/**
 * Batch request schema for attraction operations
 * Used for retrieving multiple attractions by their IDs
 *
 * @example
 * ```typescript
 * const request = {
 *   ids: ['att_123', 'att_456', 'att_789'],
 *   fields: ['id', 'name', 'description'] // Optional field selection
 * };
 * ```
 */
export const AttractionBatchRequestSchema = z.object({
    /**
     * Array of attraction IDs to retrieve
     * Limited to 100 IDs per request for performance
     */
    ids: z
        .array(z.string().uuid('Invalid attraction ID format'))
        .min(1, 'At least one attraction ID is required')
        .max(100, 'Maximum 100 attraction IDs allowed per request'),

    /**
     * Optional array of field names to include in the response
     * If not provided, all fields will be returned
     * Always includes 'id' and 'name' for entity selectors to work
     */
    fields: z.array(z.string().min(1, 'Field name cannot be empty')).optional()
});

/**
 * Batch response schema for attraction operations
 * Returns an array of attractions or null for not found items
 *
 * @example
 * ```typescript
 * const response = [
 *   { id: 'att_123', name: 'Central Park', ... },
 *   null, // att_456 not found
 *   { id: 'att_789', name: 'Museum of Art', ... }
 * ];
 * ```
 */
export const AttractionBatchResponseSchema = z.array(AttractionSchema.nullable());

/**
 * Type definitions for batch operations
 */
export type AttractionBatchRequest = z.infer<typeof AttractionBatchRequestSchema>;
export type AttractionBatchResponse = z.infer<typeof AttractionBatchResponseSchema>;
