import { z } from 'zod';
import { ExperienceSchema } from './experience.schema.js';

/**
 * Experience Batch Schemas
 *
 * Used for retrieving multiple experience listings by their IDs in a single request.
 */

/**
 * Batch request schema for experience operations.
 *
 * @example
 * ```ts
 * const request = {
 *   ids: ['uuid-1', 'uuid-2'],
 *   fields: ['id', 'name', 'type']
 * };
 * ```
 */
export const ExperienceBatchRequestSchema = z.object({
    /**
     * Array of experience listing IDs to retrieve.
     * Limited to 100 IDs per request for performance.
     */
    ids: z
        .array(z.string().uuid('Invalid experience ID format'))
        .min(1, 'At least one experience ID is required')
        .max(100, 'Maximum 100 experience IDs allowed per request'),

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
export const ExperienceBatchItemSchema = ExperienceSchema.partial().required({ id: true });

/**
 * Batch response schema — array of experience items or null for not-found entries.
 */
export const ExperienceBatchResponseSchema = z.array(ExperienceBatchItemSchema.nullable());

/** TypeScript types for batch operations. */
export type ExperienceBatchRequest = z.infer<typeof ExperienceBatchRequestSchema>;
export type ExperienceBatchItem = z.infer<typeof ExperienceBatchItemSchema>;
export type ExperienceBatchResponse = z.infer<typeof ExperienceBatchResponseSchema>;
