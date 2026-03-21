import type { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';

/**
 * Admin search schema for event organizers.
 * Extends base admin search with no additional entity-specific filters.
 *
 * Note: The `event_organizers` table has no `isVerified` column.
 * Use the inherited `status` filter to filter by lifecycle state,
 * and `search` for text-based filtering across name/description.
 *
 * @example
 * ```ts
 * const params = EventOrganizerAdminSearchSchema.parse({
 *   page: 1,
 *   search: 'john',
 *   status: 'ACTIVE'
 * });
 * ```
 */
export const EventOrganizerAdminSearchSchema = AdminSearchBaseSchema.extend({});

/** Inferred TypeScript type for event organizer admin search parameters */
export type EventOrganizerAdminSearch = z.infer<typeof EventOrganizerAdminSearchSchema>;
