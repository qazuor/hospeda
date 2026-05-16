import { z } from 'zod';
import { AmenitySchema } from './amenity.schema.js';

/**
 * Batch request schema for amenity operations
 * Used for retrieving multiple amenities by their IDs
 *
 * @example
 * ```typescript
 * const request = {
 *   ids: ['amty_123', 'amty_456', 'amty_789'],
 *   fields: ['id', 'name', 'description'] // Optional field selection
 * };
 * ```
 */
export const AmenityBatchRequestSchema = z.object({
    /**
     * Array of amenity IDs to retrieve
     * Limited to 100 IDs per request for performance
     */
    ids: z
        .array(z.string().uuid('Invalid amenity ID format'))
        .min(1, 'At least one amenity ID is required')
        .max(100, 'Maximum 100 amenity IDs allowed per request'),

    /**
     * Optional array of field names to include in the response
     * If not provided, all fields will be returned
     * Always includes 'id' and 'name' for entity selectors to work
     */
    fields: z
        .array(z.string())
        .optional()
        .describe('Optional field selection for response optimization')
});

/**
 * Batch response schema for amenity operations
 * Returns an array of amenities or null for missing/inaccessible amenities
 *
 * @example
 * ```typescript
 * const response = [
 *   { id: 'amty_123', name: 'WiFi', type: 'connectivity' },
 *   null, // amenity not found or not accessible
 *   { id: 'amty_789', name: 'Pool', type: 'recreation' }
 * ];
 * ```
 */
/**
 * Batch item schema for amenity operations
 * All fields are optional except `id` (the handler always emits it).
 */
export const AmenityBatchItemSchema = AmenitySchema.partial().required({ id: true });

export const AmenityBatchResponseSchema = z.array(
    AmenityBatchItemSchema.nullable().describe('Amenity data or null if not found/accessible')
);

// Type exports for TypeScript usage
export type AmenityBatchRequest = z.infer<typeof AmenityBatchRequestSchema>;
export type AmenityBatchItem = z.infer<typeof AmenityBatchItemSchema>;
export type AmenityBatchResponse = z.infer<typeof AmenityBatchResponseSchema>;
