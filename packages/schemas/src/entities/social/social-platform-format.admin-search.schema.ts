import type { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';
import { SocialMediaTypeEnumSchema } from '../../enums/social-media-type.schema.js';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';
import { SocialPublishFormatEnumSchema } from '../../enums/social-publish-format.schema.js';

/**
 * Admin search schema for social platform formats.
 * Extends base admin search with format-specific filters.
 *
 * @example
 * ```ts
 * const params = SocialPlatformFormatAdminSearchSchema.parse({
 *   page: 1,
 *   platform: 'INSTAGRAM',
 *   enabled: true,
 *   mvpEnabled: true
 * });
 * ```
 */
export const SocialPlatformFormatAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by platform */
    platform: SocialPlatformEnumSchema.optional().describe('Filter by platform'),

    /** Filter by publish format */
    publishFormat: SocialPublishFormatEnumSchema.optional().describe('Filter by publish format'),

    /** Filter by media type */
    mediaType: SocialMediaTypeEnumSchema.optional().describe('Filter by media type'),

    /** Filter by enabled status */
    enabled: queryBooleanParam().describe('Filter by enabled status'),

    /** Filter by MVP-enabled status */
    mvpEnabled: queryBooleanParam().describe('Filter by MVP-enabled status')
});

/**
 * Type inferred from {@link SocialPlatformFormatAdminSearchSchema}.
 */
export type SocialPlatformFormatAdminSearch = z.infer<typeof SocialPlatformFormatAdminSearchSchema>;
