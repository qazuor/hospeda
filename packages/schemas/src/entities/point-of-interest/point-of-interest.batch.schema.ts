import { z } from 'zod';
import { PointOfInterestSchema } from './point-of-interest.schema.js';

/**
 * Batch request schema for point-of-interest operations
 * Used for retrieving multiple points of interest by their IDs
 * (HOS-143 T-002).
 *
 * @example
 * ```typescript
 * const request = {
 *   ids: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'],
 *   fields: ['id', 'slug', 'nameI18n'] // Optional field selection
 * };
 * ```
 */
export const PointOfInterestBatchRequestSchema = z.object({
    /**
     * Array of point-of-interest IDs to retrieve
     * Limited to 100 IDs per request for performance
     */
    ids: z
        .array(z.string().uuid('Invalid point of interest ID format'))
        .min(1, 'At least one point of interest ID is required')
        .max(100, 'Maximum 100 point of interest IDs allowed per request'),

    /**
     * Optional array of field names to include in the response
     * If not provided, all fields will be returned
     * Always includes 'id' and 'slug' for entity selectors to work — POIs
     * have no `name` column (HOS-113 OQ-2), so `slug` is the stable
     * plain-string identifier used in place of `name`.
     */
    fields: z.array(z.string().min(1, 'Field name cannot be empty')).optional()
});

/**
 * Batch item schema for point-of-interest operations
 * All fields are optional except `id` (the handler always emits it).
 */
export const PointOfInterestBatchItemSchema = PointOfInterestSchema.partial().required({
    id: true
});

/**
 * Batch response schema for point-of-interest operations
 * Returns an array of points of interest or null for not found items
 *
 * @example
 * ```typescript
 * const response = [
 *   { id: '550e8400-e29b-41d4-a716-446655440000', slug: 'plaza-central', ... },
 *   null, // not found
 *   { id: '550e8400-e29b-41d4-a716-446655440001', slug: 'museo-historico', ... }
 * ];
 * ```
 */
export const PointOfInterestBatchResponseSchema = z.array(
    PointOfInterestBatchItemSchema.nullable()
);

/**
 * Type definitions for batch operations
 */
export type PointOfInterestBatchRequest = z.infer<typeof PointOfInterestBatchRequestSchema>;
export type PointOfInterestBatchItem = z.infer<typeof PointOfInterestBatchItemSchema>;
export type PointOfInterestBatchResponse = z.infer<typeof PointOfInterestBatchResponseSchema>;
