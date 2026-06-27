import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';

/**
 * Admin search schema for social campaigns.
 * Extends base admin search with campaign-specific filters.
 *
 * @example
 * ```ts
 * const params = SocialCampaignAdminSearchSchema.parse({
 *   page: 1,
 *   active: true,
 *   search: 'hospeda'
 * });
 * ```
 */
export const SocialCampaignAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by active status */
    active: queryBooleanParam().describe('Filter by active status'),

    /** Filter campaigns starting after this date */
    startsAfter: z.coerce.date().optional().describe('Filter campaigns starting after this date'),

    /** Filter campaigns ending before this date */
    endsBefore: z.coerce.date().optional().describe('Filter campaigns ending before this date')
});

/**
 * Type inferred from {@link SocialCampaignAdminSearchSchema}.
 */
export type SocialCampaignAdminSearch = z.infer<typeof SocialCampaignAdminSearchSchema>;
