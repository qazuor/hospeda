import type { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { createBooleanQueryParam } from '../../common/boolean-params.js';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';

/**
 * Admin search schema for social post footers.
 * Extends base admin search with footer-specific filters.
 *
 * @example
 * ```ts
 * const params = SocialPostFooterAdminSearchSchema.parse({
 *   page: 1,
 *   platform: 'INSTAGRAM',
 *   isDefault: true
 * });
 * ```
 */
export const SocialPostFooterAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by platform restriction */
    platform: SocialPlatformEnumSchema.optional().describe('Filter by platform restriction'),

    /** Filter by active status */
    active: createBooleanQueryParam('Filter by active status'),

    /** Filter by default status */
    isDefault: createBooleanQueryParam('Filter default footers')
});

/**
 * Type inferred from {@link SocialPostFooterAdminSearchSchema}.
 */
export type SocialPostFooterAdminSearch = z.infer<typeof SocialPostFooterAdminSearchSchema>;
