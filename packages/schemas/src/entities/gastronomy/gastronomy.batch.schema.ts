import { z } from 'zod';
import { GastronomySchema } from './gastronomy.schema.js';

/**
 * Gastronomy Batch Schemas
 *
 * Used for retrieving multiple gastronomy listings by their IDs in a single request.
 */

/**
 * Batch request schema for gastronomy operations.
 *
 * @example
 * ```ts
 * const request = {
 *   ids: ['uuid-1', 'uuid-2'],
 *   fields: ['id', 'name', 'type']
 * };
 * ```
 */
export const GastronomyBatchRequestSchema = z.object({
    /**
     * Array of gastronomy listing IDs to retrieve.
     * Limited to 100 IDs per request for performance.
     */
    ids: z
        .array(z.string().uuid('Invalid gastronomy ID format'))
        .min(1, 'At least one gastronomy ID is required')
        .max(100, 'Maximum 100 gastronomy IDs allowed per request'),

    /**
     * Optional array of field names to include in the response.
     * If not provided, all fields will be returned.
     * Always includes 'id' and 'name' for entity selectors.
     */
    fields: z.array(z.string().min(1, 'Field name cannot be empty')).optional()
});

/**
 * Batch item schema: all fields optional except `id` (always emitted).
 */
export const GastronomyBatchItemSchema = GastronomySchema.partial().required({ id: true });

/**
 * Batch response schema — array of gastronomy items or null for not-found entries.
 */
export const GastronomyBatchResponseSchema = z.array(GastronomyBatchItemSchema.nullable());

/** TypeScript types for batch operations. */
export type GastronomyBatchRequest = z.infer<typeof GastronomyBatchRequestSchema>;
export type GastronomyBatchItem = z.infer<typeof GastronomyBatchItemSchema>;
export type GastronomyBatchResponse = z.infer<typeof GastronomyBatchResponseSchema>;
