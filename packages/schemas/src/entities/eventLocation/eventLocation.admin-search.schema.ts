import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';

/**
 * Admin search schema for event locations.
 * Extends base admin search with location-specific filters.
 *
 * Note: The `event_locations` table has no `isVerified` column and no `capacity` column.
 * Only `city` is a direct filterable column on this table.
 *
 * @example
 * ```ts
 * const params = EventLocationAdminSearchSchema.parse({
 *   page: 1,
 *   city: 'Buenos Aires',
 *   status: 'ACTIVE'
 * });
 * ```
 */
export const EventLocationAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by city */
    city: z.string().optional().describe('Filter by city name')
});

/** Inferred TypeScript type for event location admin search parameters */
export type EventLocationAdminSearch = z.infer<typeof EventLocationAdminSearchSchema>;
