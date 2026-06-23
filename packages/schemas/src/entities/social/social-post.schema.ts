import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { SocialApprovalStatusEnum } from '../../enums/social-approval-status.enum.js';
import { SocialApprovalStatusEnumSchema } from '../../enums/social-approval-status.schema.js';
import { SocialPostStatusEnum } from '../../enums/social-post-status.enum.js';
import { SocialPostStatusEnumSchema } from '../../enums/social-post-status.schema.js';
import { SocialRecurrenceTypeEnum } from '../../enums/social-recurrence-type.enum.js';
import { SocialRecurrenceTypeEnumSchema } from '../../enums/social-recurrence-type.schema.js';
import { SocialSourceEnumSchema } from '../../enums/social-source.schema.js';

/**
 * SocialPost entity schema.
 * Master record for every social media post in the pipeline —
 * from GPT draft through approval, scheduling, dispatch, and publish.
 * Supports soft-delete and full audit FKs.
 */
export const SocialPostSchema = z.object({
    id: z.string().uuid({ message: 'zodError.socialPost.id.uuid' }),
    /**
     * Opaque external ID assigned by the GPT at draft creation.
     * UNIQUE — used as an idempotency key to prevent duplicate ingestion.
     */
    draftId: z.string().min(1, { message: 'zodError.socialPost.draftId.required' }),
    title: z.string().min(1, { message: 'zodError.socialPost.title.required' }),
    slug: z.string().min(1, { message: 'zodError.socialPost.slug.required' }),
    source: SocialSourceEnumSchema,
    /** Content pillar label (e.g. "travel", "gastronomy", "institutional") */
    pillar: z.string().optional(),
    /** Optional campaign association */
    campaignId: z.string().uuid({ message: 'zodError.socialPost.campaignId.uuid' }).optional(),
    /** Optional batch / sprint association */
    batchId: z.string().uuid({ message: 'zodError.socialPost.batchId.uuid' }).optional(),
    /** Position within the batch for ordering */
    batchPosition: z.number().int().optional(),
    /** Optional audience association */
    audienceId: z.string().uuid({ message: 'zodError.socialPost.audienceId.uuid' }).optional(),
    /** Optional footer template for this post */
    footerId: z.string().uuid({ message: 'zodError.socialPost.footerId.uuid' }).optional(),
    /** Optional base hashtag set for this post */
    baseHashtagSetId: z
        .string()
        .uuid({ message: 'zodError.socialPost.baseHashtagSetId.uuid' })
        .optional(),
    /** Original caption text as submitted by the GPT or admin */
    captionBase: z.string().min(1, { message: 'zodError.socialPost.captionBase.required' }),
    /** Final edited caption, ready for publish. Null until admin finalizes. */
    finalCaption: z.string().optional(),
    /** Final hashtag block as a single text string, appended at publish time */
    finalHashtagsText: z.string().optional(),
    status: SocialPostStatusEnumSchema.default(SocialPostStatusEnum.NEEDS_REVIEW),
    approvalStatus: SocialApprovalStatusEnumSchema.default(SocialApprovalStatusEnum.PENDING),
    /**
     * When true the dispatch cron skips this post entirely.
     * Only settable by admins via explicit pause/unpause actions.
     */
    paused: z.boolean().default(false),
    /** Number of dispatch retries across all targets */
    retryCount: z.number().int().min(0).default(0),
    /** UTC timestamp when the post is scheduled to publish */
    scheduledAt: z.coerce.date().optional(),
    /** IANA timezone string, e.g. "America/Argentina/Buenos_Aires" */
    timezone: z.string().default('America/Argentina/Buenos_Aires'),
    recurrenceType: SocialRecurrenceTypeEnumSchema.default(SocialRecurrenceTypeEnum.ONCE),
    /**
     * JSON params for recurrence (e.g. { weekday: "MONDAY" } for WEEKLY).
     * Null when recurrence_type = ONCE.
     */
    recurrenceParamsJson: z.record(z.string(), z.unknown()).optional(),
    /**
     * Next cron pickup time. Set to scheduled_at on schedule, to now() on
     * mark-ready, and recomputed after each successful publish for recurring posts.
     */
    nextRunAt: z.coerce.date().optional(),
    /** Admin-visible notes (rejection reasons, change requests, etc.) */
    notes: z.string().optional(),
    /** Internal team notes — never sent to GPT or external systems */
    internalNotes: z.string().optional(),
    /**
     * Raw GPT hashtag suggestions (custom/novel hashtags not in the catalog).
     * Stored for review; admins can promote these to social_hashtags.
     */
    gptHashtagPayloadJson: z.array(z.string()).optional(),
    /** Miscellaneous metadata bag */
    metadataJson: z.record(z.string(), z.unknown()).optional(),
    /** Admin who approved this post. Set at approval time. */
    approvedById: z.string().uuid({ message: 'zodError.socialPost.approvedById.uuid' }).optional(),
    approvedAt: z.coerce.date().optional(),
    ...BaseAuditFields
});

/** TypeScript type inferred from {@link SocialPostSchema}. */
export type SocialPost = z.infer<typeof SocialPostSchema>;

/**
 * Minimal projection returned by the admin list endpoint
 * (`GET /api/v1/admin/social/posts`).
 *
 * The list query does NOT hydrate the full {@link SocialPostSchema} entity —
 * it returns a lightweight row for table rendering (title, status, target
 * platforms, thumbnail, schedule). Mirrors `SocialPostListItem` in
 * `@repo/service-core` (`SocialPostService.list`). Using the full entity schema
 * as the list response contract is incorrect: the projection omits most entity
 * fields, so validation would reject every row once the list is non-empty.
 */
export const SocialPostListItemSchema = z.object({
    id: z.string().uuid({ message: 'zodError.socialPost.id.uuid' }),
    title: z.string(),
    slug: z.string(),
    status: SocialPostStatusEnumSchema,
    approvalStatus: SocialApprovalStatusEnumSchema,
    paused: z.boolean(),
    /** Target platforms derived from `social_post_targets`. */
    platforms: z.array(z.string()),
    /** Cloudinary URL of the first media asset, or null when there is none. */
    thumbnailUrl: z.string().nullable(),
    /** Scheduled publication datetime, or null. */
    scheduledAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date()
});

/** TypeScript type inferred from {@link SocialPostListItemSchema}. */
export type SocialPostListItem = z.infer<typeof SocialPostListItemSchema>;
