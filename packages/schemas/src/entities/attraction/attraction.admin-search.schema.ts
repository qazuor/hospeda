import type { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';

/**
 * Admin search schema for attractions.
 * Extends base admin search with attraction-specific filters.
 *
 * Note: `destinationId` is NOT a direct column on the attractions table.
 * Attractions are linked to destinations via the `r_destination_attraction`
 * relation table. Use the relation-based query methods for destination filtering.
 *
 * @example
 * ```ts
 * const params = AttractionAdminSearchSchema.parse({
 *   page: 1,
 *   isFeatured: true,
 *   search: 'museo'
 * });
 * ```
 */
export const AttractionAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter featured attractions */
    isFeatured: queryBooleanParam().describe('Filter by featured status')
});

/** Inferred TypeScript type for attraction admin search parameters */
export type AttractionAdminSearch = z.infer<typeof AttractionAdminSearchSchema>;
