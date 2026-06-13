import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { I18nTextSchema, TranslationMetaSchema } from '../../common/i18n.schema.js';
import {
    AccommodationIdSchema,
    DestinationIdSchema,
    EventIdSchema,
    PostIdSchema,
    PostSponsorshipIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { BaseMediaFields } from '../../common/media.schema.js';
import { BaseModerationFields } from '../../common/moderation.schema.js';
import { BaseSeoFields } from '../../common/seo.schema.js';
import { BaseVisibilityFields } from '../../common/visibility.schema.js';
import { PostCategoryEnumSchema } from '../../enums/index.js';
import { PostTagSchema } from '../tag/post-tag.schema.js';
import { TagSchema } from '../tag/tag.schema.js';

/**
 * Post Schema - Main Entity Schema
 *
 * This schema defines the complete structure of a Post entity
 * using base field objects for consistency and maintainability.
 */
export const PostSchema = z.object({
    // Base fields
    id: PostIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,
    ...BaseModerationFields,
    ...BaseSeoFields,
    ...BaseVisibilityFields,
    // User-tags (private, no slug — SPEC-086 D-002).
    tags: z.array(TagSchema).optional(),

    /**
     * Public, SEO-driven PostTags assigned to this post via the
     * `r_post_post_tag` join table (SPEC-086). Different subsystem from
     * the `tags` field above. Optional because the JOIN is only loaded
     * by the public read paths (getById, getBySlug, list).
     */
    postTags: z.array(PostTagSchema).optional(),

    // Post-specific core fields
    slug: z
        .string({
            message: 'zodError.post.slug.required'
        })
        .min(1, { message: 'zodError.post.slug.min' }),

    title: z
        .string({
            message: 'zodError.post.title.required'
        })
        .min(3, { message: 'zodError.post.title.min' })
        .max(150, { message: 'zodError.post.title.max' }),

    summary: z
        .string({
            message: 'zodError.post.summary.required'
        })
        .min(10, { message: 'zodError.post.summary.min' })
        .max(300, { message: 'zodError.post.summary.max' }),

    content: z
        .string({
            message: 'zodError.post.content.required'
        })
        .min(100, { message: 'zodError.post.content.min' })
        .max(50000, { message: 'zodError.post.content.max' }),

    // SPEC-212: I18nText translations for multi-language content.
    // Mirror the plain text fields above (title/summary/content).
    // Nullish: DB columns are nullable jsonb with no default. Surfaced on
    // public + admin responses so web/admin can render en/pt.
    titleI18n: I18nTextSchema.nullish(),
    summaryI18n: I18nTextSchema.nullish(),
    contentI18n: I18nTextSchema.nullish(),

    /**
     * Per-field, per-locale translation curation metadata (SPEC-212).
     * Internal: exposed on admin responses only, never on public payloads.
     */
    translationMeta: TranslationMetaSchema.nullish(),

    category: PostCategoryEnumSchema,

    isFeatured: z.boolean().default(false),
    isFeaturedInWebsite: z.boolean().default(false),
    expiresAt: z.date().nullish(),

    // Author
    authorId: UserIdSchema,

    // Media
    ...BaseMediaFields,

    // Post-specific flags
    isNews: z.boolean().default(false),

    // Social engagement
    likes: z.number().int().min(0).default(0),
    comments: z.number().int().min(0).default(0),
    shares: z.number().int().min(0).default(0),

    // Display fields
    publishedAt: z.coerce.date().nullish(), // Publication date (can be different from createdAt)
    readingTimeMinutes: z.number().int().min(0).default(5), // Estimated reading time

    // Related entities
    relatedDestinationId: DestinationIdSchema.nullish(),
    relatedAccommodationId: AccommodationIdSchema.nullish(),
    relatedEventId: EventIdSchema.nullish(),

    // Sponsorship
    sponsorshipId: PostSponsorshipIdSchema.nullish()
});

/**
 * Type export for the main Post entity
 */
export type Post = z.infer<typeof PostSchema>;
