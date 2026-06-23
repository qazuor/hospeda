import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { SocialAssetSourceEnumSchema } from '../../enums/social-asset-source.schema.js';
import { SocialMediaTypeEnumSchema } from '../../enums/social-media-type.schema.js';

/**
 * Admin search schema for social assets.
 * Extends base admin search with asset-specific filters.
 *
 * @example
 * ```ts
 * const params = SocialAssetAdminSearchSchema.parse({
 *   page: 1,
 *   mediaType: 'IMAGE',
 *   source: 'CHATGPT_FILE'
 * });
 * ```
 */
export const SocialAssetAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by asset source */
    source: SocialAssetSourceEnumSchema.optional().describe('Filter by asset source'),

    /** Filter by media type */
    mediaType: SocialMediaTypeEnumSchema.optional().describe('Filter by media type'),

    /** Filter by Cloudinary public ID prefix */
    cloudinaryPublicId: z
        .string()
        .optional()
        .describe('Filter by Cloudinary public ID (partial match)')
});

/**
 * Type inferred from {@link SocialAssetAdminSearchSchema}.
 */
export type SocialAssetAdminSearch = z.infer<typeof SocialAssetAdminSearchSchema>;
