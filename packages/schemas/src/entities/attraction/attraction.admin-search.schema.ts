import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';

/**
 * Admin search schema for attractions.
 * Extends base admin search with attraction-specific filters.
 *
 * @example
 * ```ts
 * const params = AttractionAdminSearchSchema.parse({
 *   page: 1,
 *   destinationId: '550e8400-e29b-41d4-a716-446655440000',
 *   category: 'museum',
 *   isFeatured: true
 * });
 * ```
 */
export const AttractionAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by destination UUID */
    destinationId: z
        .string()
        .uuid({ message: 'zodError.admin.search.attraction.destinationId.uuid' })
        .optional()
        .describe('Filter by destination'),
    /** Filter by attraction category */
    category: z.string().optional().describe('Filter by attraction category'),
    /** Filter featured attractions */
    isFeatured: queryBooleanParam().describe('Filter by featured status')
});

/** Inferred TypeScript type for attraction admin search parameters */
export type AttractionAdminSearch = z.infer<typeof AttractionAdminSearchSchema>;
