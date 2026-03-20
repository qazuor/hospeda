import type { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';

/**
 * Admin search schema for event organizers.
 * Extends base admin search with organizer-specific filters.
 */
export const EventOrganizerAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by verified status */
    isVerified: queryBooleanParam().describe('Filter by verified status')
});

export type EventOrganizerAdminSearch = z.infer<typeof EventOrganizerAdminSearchSchema>;
