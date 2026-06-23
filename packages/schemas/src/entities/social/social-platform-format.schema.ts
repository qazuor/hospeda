import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { SocialMediaTypeEnumSchema } from '../../enums/social-media-type.schema.js';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';
import { SocialPublishFormatEnumSchema } from '../../enums/social-publish-format.schema.js';

/**
 * SocialPlatformFormat entity schema.
 * Per-platform × publish-format configuration row
 * (e.g. INSTAGRAM × FEED_POST).
 * Composite UNIQUE on (platform, publishFormat).
 * Supports soft-delete and full audit FKs.
 */
export const SocialPlatformFormatSchema = z.object({
    id: z.string().uuid({ message: 'zodError.socialPlatformFormat.id.uuid' }),
    platform: SocialPlatformEnumSchema,
    publishFormat: SocialPublishFormatEnumSchema,
    mediaType: SocialMediaTypeEnumSchema,
    enabled: z.boolean().default(true),
    /** Whether this format is enabled for the MVP phase */
    mvpEnabled: z.boolean().default(false),
    /** Aspect ratio recommendation, e.g. "1:1", "9:16" */
    recommendedRatio: z.string().optional(),
    /** Pixel dimensions recommendation, e.g. "1080x1080" */
    recommendedSize: z.string().optional(),
    /** Maximum caption length in characters (platform limit) */
    maxCaptionLength: z.number().int().positive().optional(),
    /** Whether this format requires a reachable public URL for the media */
    requiresPublicUrl: z.boolean().default(false),
    /** Whether this format requires at least one media asset */
    requiresMedia: z.boolean().default(false),
    /** Make.com scenario channel key for routing dispatch */
    makeChannelKey: z.string().optional(),
    notes: z.string().optional(),
    ...BaseAuditFields
});

/** TypeScript type inferred from {@link SocialPlatformFormatSchema}. */
export type SocialPlatformFormat = z.infer<typeof SocialPlatformFormatSchema>;
