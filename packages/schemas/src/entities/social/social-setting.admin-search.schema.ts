import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';

/**
 * Admin search schema for social settings.
 * Extends base admin search with setting-specific filters.
 *
 * @example
 * ```ts
 * const params = SocialSettingAdminSearchSchema.parse({
 *   page: 1,
 *   active: true,
 *   type: 'string'
 * });
 * ```
 */
export const SocialSettingAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by value type */
    type: z
        .enum(['string', 'number', 'boolean', 'json', 'secret'])
        .optional()
        .describe('Filter by value type'),

    /** Filter by active status */
    active: queryBooleanParam().describe('Filter by active status')
});

/**
 * Type inferred from {@link SocialSettingAdminSearchSchema}.
 */
export type SocialSettingAdminSearch = z.infer<typeof SocialSettingAdminSearchSchema>;
