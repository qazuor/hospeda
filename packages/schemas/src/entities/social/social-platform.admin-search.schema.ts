import type { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';

/**
 * Admin search schema for social platforms.
 * Extends base admin search with platform-specific filters.
 *
 * @example
 * ```ts
 * const params = SocialPlatformAdminSearchSchema.parse({
 *   page: 1,
 *   platform: 'INSTAGRAM',
 *   enabled: true
 * });
 * ```
 */
export const SocialPlatformAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by specific platform enum value */
    platform: SocialPlatformEnumSchema.optional().describe('Filter by platform'),

    /** Filter by enabled status */
    enabled: queryBooleanParam().describe('Filter by enabled status')
});

/**
 * Type inferred from {@link SocialPlatformAdminSearchSchema}.
 */
export type SocialPlatformAdminSearch = z.infer<typeof SocialPlatformAdminSearchSchema>;
