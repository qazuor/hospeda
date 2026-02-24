import type { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { ClientTypeEnumSchema } from '../../enums/index.js';

/**
 * Admin search schema for post sponsors.
 * Extends base admin search with sponsor-specific filters.
 */
export const PostSponsorAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by client/sponsor type */
    type: ClientTypeEnumSchema.optional().describe('Filter by sponsor type')
});

export type PostSponsorAdminSearch = z.infer<typeof PostSponsorAdminSearchSchema>;
