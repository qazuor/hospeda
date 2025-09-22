import { z } from 'zod';
import { AccommodationSchema } from './accommodation.schema';

/**
 * Batch request schema for accommodation operations
 * Used for retrieving multiple accommodations by their IDs
 *
 * @example
 * ```typescript
 * const request = {
 *   ids: ['acc_123', 'acc_456', 'acc_789'],
 *   fields: ['id', 'name', 'summary'] // Optional field selection
 * };
 * ```
 */
export const AccommodationBatchRequestSchema = z.object({
    /**
     * Array of accommodation IDs to retrieve
     * Limited to 100 IDs per request for performance
     */
    ids: z
        .array(z.string().uuid('Invalid accommodation ID format'))
        .min(1, 'At least one accommodation ID is required')
        .max(100, 'Maximum 100 accommodation IDs allowed per request'),

    /**
     * Optional array of field names to include in the response
     * If not provided, all fields will be returned
     * Always includes 'id' and 'name' for entity selectors to work
     */
    fields: z.array(z.string().min(1, 'Field name cannot be empty')).optional()
});

/**
 * Batch response schema for accommodation operations
 * Returns an array of accommodations or null for not found items
 *
 * @example
 * ```typescript
 * const response = [
 *   { id: 'acc_123', name: 'Hotel Paradise', ... },
 *   null, // acc_456 not found
 *   { id: 'acc_789', name: 'Beach Resort', ... }
 * ];
 * ```
 */
export const AccommodationBatchResponseSchema = z.array(AccommodationSchema.nullable());

/**
 * Type definitions for batch operations
 */
export type AccommodationBatchRequest = z.infer<typeof AccommodationBatchRequestSchema>;
export type AccommodationBatchResponse = z.infer<typeof AccommodationBatchResponseSchema>;
