import type { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';

/**
 * Admin search schema for social hashtag sets.
 * Extends base admin search with hashtag-set-specific filters.
 *
 * @example
 * ```ts
 * const params = SocialHashtagSetAdminSearchSchema.parse({
 *   page: 1,
 *   platform: 'INSTAGRAM',
 *   active: true
 * });
 * ```
 */
export const SocialHashtagSetAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by platform restriction */
    platform: SocialPlatformEnumSchema.optional().describe('Filter by platform restriction'),

    /** Filter by active status */
    active: queryBooleanParam().describe('Filter by active status')
});

/**
 * Type inferred from {@link SocialHashtagSetAdminSearchSchema}.
 */
export type SocialHashtagSetAdminSearch = z.infer<typeof SocialHashtagSetAdminSearchSchema>;
