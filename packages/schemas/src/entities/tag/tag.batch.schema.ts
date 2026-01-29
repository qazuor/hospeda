import { z } from 'zod';
import { TagIdSchema } from '../../common/id.schema.js';
import { TagSchema } from './tag.schema.js';

/**
 * Batch request schema for tag operations
 * Used for retrieving multiple tags by their IDs
 *
 * @example
 * ```typescript
 * const request = {
 *   ids: ['tag_123', 'tag_456', 'tag_789'],
 *   fields: ['id', 'name', 'color'] // Optional field selection
 * };
 * ```
 */
export const TagBatchRequestSchema = z.object({
    /**
     * Array of tag IDs to retrieve
     * Limited to 100 IDs per request for performance
     */
    ids: z
        .array(TagIdSchema)
        .min(1, 'At least one tag ID is required')
        .max(100, 'Maximum 100 tag IDs allowed per request'),

    /**
     * Optional array of field names to include in the response
     * If not provided, all fields will be returned
     * Always includes 'id' and 'name' for entity selectors to work
     */
    fields: z.array(z.string().min(1, 'Field name cannot be empty')).optional()
});

/**
 * Batch response schema for tag operations
 * Returns an array of tags or null for not found items
 *
 * @example
 * ```typescript
 * const response = [
 *   { id: 'tag_123', name: 'Beach', color: 'blue', ... },
 *   null, // tag_456 not found
 *   { id: 'tag_789', name: 'Mountain', color: 'green', ... }
 * ];
 * ```
 */
export const TagBatchResponseSchema = z.array(TagSchema.nullable());

/**
 * Type definitions for batch operations
 */
export type TagBatchRequest = z.infer<typeof TagBatchRequestSchema>;
export type TagBatchResponse = z.infer<typeof TagBatchResponseSchema>;
