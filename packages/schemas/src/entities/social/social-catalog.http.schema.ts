import { z } from 'zod';
import { SocialMediaTypeEnumSchema } from '../../enums/social-media-type.schema.js';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';
import { SocialPublishFormatEnumSchema } from '../../enums/social-publish-format.schema.js';

/**
 * GPT-safe shape for a SocialHashtag entry.
 * Strips audit FKs (createdById, updatedById, deletedAt, deletedById) and
 * internal `notes` that should not be exposed to the Custom GPT.
 */
export const CatalogHashtagSchema = z.object({
    id: z.string().uuid(),
    hashtag: z.string(),
    normalizedHashtag: z.string(),
    category: z.string(),
    platform: SocialPlatformEnumSchema.nullable().optional(),
    audienceId: z.string().uuid().nullable().optional(),
    priority: z.number().int(),
    active: z.boolean()
});

/**
 * GPT-safe shape for a SocialHashtagSet entry.
 */
export const CatalogHashtagSetSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    platform: SocialPlatformEnumSchema.nullable().optional(),
    hashtagsText: z.string(),
    priority: z.number().int(),
    active: z.boolean()
});

/**
 * GPT-safe shape for a SocialPostFooter entry.
 */
export const CatalogFooterSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    content: z.string(),
    platform: SocialPlatformEnumSchema.nullable().optional(),
    active: z.boolean(),
    isDefault: z.boolean(),
    priority: z.number().int()
});

/**
 * GPT-safe shape for a SocialPlatformFormat entry.
 */
export const CatalogPlatformFormatSchema = z.object({
    id: z.string().uuid(),
    platform: SocialPlatformEnumSchema,
    publishFormat: SocialPublishFormatEnumSchema,
    mediaType: SocialMediaTypeEnumSchema,
    enabled: z.boolean(),
    mvpEnabled: z.boolean(),
    recommendedRatio: z.string().nullable().optional(),
    recommendedSize: z.string().nullable().optional(),
    maxCaptionLength: z.number().int().nonnegative().nullable().optional(),
    requiresPublicUrl: z.boolean(),
    requiresMedia: z.boolean(),
    makeChannelKey: z.string().nullable().optional()
});

/**
 * GPT-safe shape for a SocialCampaign entry.
 */
export const CatalogCampaignSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable().optional(),
    active: z.boolean(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional()
});

/**
 * GPT-safe shape for a SocialContentBatch entry.
 */
export const CatalogBatchSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable().optional(),
    active: z.boolean(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional()
});

/**
 * GPT-safe shape for a SocialAudience entry.
 */
export const CatalogAudienceSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable().optional(),
    active: z.boolean()
});

/**
 * Defaults block assembled from social_settings rows.
 * Exposes the four catalog settings the GPT needs for pre-filling drafts.
 */
export const CatalogDefaultsSchema = z.object({
    timezone: z.string(),
    campaignSlug: z.string(),
    batchSlug: z.string(),
    maxHashtagsPerPlatform: z.object({
        INSTAGRAM: z.number().int(),
        FACEBOOK: z.number().int(),
        X: z.number().int()
    })
});

/**
 * Full catalog response data shape.
 * Returned by GET /api/v1/ai/social/catalog.
 * Reused by T-030 (OpenAPI spec export).
 */
export const SocialCatalogResponseDataSchema = z.object({
    hashtags: z.array(CatalogHashtagSchema),
    hashtagSets: z.array(CatalogHashtagSetSchema),
    footers: z.array(CatalogFooterSchema),
    platformFormats: z.array(CatalogPlatformFormatSchema),
    campaigns: z.array(CatalogCampaignSchema),
    batches: z.array(CatalogBatchSchema),
    audiences: z.array(CatalogAudienceSchema),
    defaults: CatalogDefaultsSchema
});

/** TypeScript type inferred from {@link SocialCatalogResponseDataSchema}. */
export type SocialCatalogResponseData = z.infer<typeof SocialCatalogResponseDataSchema>;
export type CatalogHashtag = z.infer<typeof CatalogHashtagSchema>;
export type CatalogHashtagSet = z.infer<typeof CatalogHashtagSetSchema>;
export type CatalogFooter = z.infer<typeof CatalogFooterSchema>;
export type CatalogPlatformFormat = z.infer<typeof CatalogPlatformFormatSchema>;
export type CatalogCampaign = z.infer<typeof CatalogCampaignSchema>;
export type CatalogBatch = z.infer<typeof CatalogBatchSchema>;
export type CatalogAudience = z.infer<typeof CatalogAudienceSchema>;
export type CatalogDefaults = z.infer<typeof CatalogDefaultsSchema>;
