import type { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';

/**
 * Admin search schema for social audiences.
 * Extends base admin search with audience-specific filters.
 *
 * @example
 * ```ts
 * const params = SocialAudienceAdminSearchSchema.parse({
 *   page: 1,
 *   active: true
 * });
 * ```
 */
export const SocialAudienceAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by active status */
    active: queryBooleanParam().describe('Filter by active status')
});

/**
 * Type inferred from {@link SocialAudienceAdminSearchSchema}.
 */
export type SocialAudienceAdminSearch = z.infer<typeof SocialAudienceAdminSearchSchema>;
