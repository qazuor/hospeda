import { z } from 'zod';
import { FeatureSchema } from './feature.schema.js';

/**
 * Batch request schema for feature operations
 * Used for retrieving multiple features by their IDs
 *
 * @example
 * ```typescript
 * const request = {
 *   ids: ['feat_123', 'feat_456', 'feat_789'],
 *   fields: ['id', 'name', 'description'] // Optional field selection
 * };
 * ```
 */
export const FeatureBatchRequestSchema = z.object({
    /**
     * Array of feature IDs to retrieve
     * Limited to 100 IDs per request for performance
     */
    ids: z
        .array(z.string().uuid('Invalid feature ID format'))
        .min(1, 'At least one feature ID is required')
        .max(100, 'Maximum 100 feature IDs allowed per request'),

    /**
     * Optional array of field names to include in the response
     * If not provided, all fields will be returned
     * Always includes 'id' and 'name' for entity selectors to work
     */
    fields: z.array(z.string()).optional().describe('Optional field names to include in response')
});

/**
 * Batch response schema for feature operations
 * Returns an array of features or null for IDs that don't exist
 *
 * @example
 * ```typescript
 * const response = [
 *   { id: 'feat_123', name: 'WiFi', ... },
 *   null, // feat_456 doesn't exist
 *   { id: 'feat_789', name: 'Pool', ... }
 * ];
 * ```
 */
export const FeatureBatchResponseSchema = z.array(FeatureSchema.nullable());

/**
 * Type exports for batch operations
 */
export type FeatureBatchRequest = z.infer<typeof FeatureBatchRequestSchema>;
export type FeatureBatchResponse = z.infer<typeof FeatureBatchResponseSchema>;
