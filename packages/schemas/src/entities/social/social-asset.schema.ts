import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { SocialAssetSourceEnumSchema } from '../../enums/social-asset-source.schema.js';
import { SocialMediaTypeEnumSchema } from '../../enums/social-media-type.schema.js';

/**
 * SocialAsset entity schema.
 * Cloudinary-hosted media assets referenced by social posts.
 * Supports soft-delete and full audit FKs.
 */
export const SocialAssetSchema = z.object({
    id: z.string().uuid({ message: 'zodError.socialAsset.id.uuid' }),
    source: SocialAssetSourceEnumSchema,
    /** Cloudinary delivery URL. Nullable when upload failed or is pending. */
    cloudinaryUrl: z.string().url({ message: 'zodError.socialAsset.cloudinaryUrl.url' }).optional(),
    /** Cloudinary public_id for transforms and deletion. */
    cloudinaryPublicId: z.string().optional(),
    /** Original source URL before upload (OpenAI file URL, external URL, etc.) */
    originalUrl: z.string().url({ message: 'zodError.socialAsset.originalUrl.url' }).optional(),
    /** OpenAI file reference string (e.g. "file-abc123") when source is CHATGPT_FILE */
    openaiFileRef: z.string().optional(),
    mimeType: z.string().optional(),
    mediaType: SocialMediaTypeEnumSchema,
    /** Width in pixels. Null when not yet available (pending upload). */
    width: z.number().int().positive().optional(),
    /** Height in pixels. Null when not yet available (pending upload). */
    height: z.number().int().positive().optional(),
    /** Duration in seconds for video assets. Null for images. */
    durationSeconds: z.number().int().positive().optional(),
    altText: z.string().optional(),
    caption: z.string().optional(),
    metadataJson: z.record(z.string(), z.unknown()).optional(),
    ...BaseAuditFields
});

/** TypeScript type inferred from {@link SocialAssetSchema}. */
export type SocialAsset = z.infer<typeof SocialAssetSchema>;
