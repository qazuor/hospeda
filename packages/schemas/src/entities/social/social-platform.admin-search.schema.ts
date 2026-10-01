import type { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { createBooleanQueryParam } from '../../common/boolean-params.js';
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
    enabled: createBooleanQueryParam('Filter by enabled status')
});

/**
 * Type inferred from {@link SocialPlatformAdminSearchSchema}.
 */
export type SocialPlatformAdminSearch = z.infer<typeof SocialPlatformAdminSearchSchema>;
