import { z } from 'zod';
import { SocialMediaTypeEnumSchema } from '../../enums/social-media-type.schema.js';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';
import { SocialPostStatusEnum } from '../../enums/social-post-status.enum.js';
import { SocialPostStatusEnumSchema } from '../../enums/social-post-status.schema.js';
import { SocialPublishFormatEnumSchema } from '../../enums/social-publish-format.schema.js';

/**
 * SocialPostTarget entity schema.
 * One row per platform the post should be published to.
 * Holds per-target overrides, Make.com dispatch state, and publish results.
 *
 * No soft-delete and no audit FKs by design — targets are managed via
 * cascade from the parent post.
 */
export const SocialPostTargetSchema = z.object({
    id: z.string().uuid({ message: 'zodError.socialPostTarget.id.uuid' }),
    socialPostId: z.string().uuid({ message: 'zodError.socialPostTarget.socialPostId.uuid' }),
    /** Platform-format config row this target maps to */
    platformFormatId: z
        .string()
        .uuid({ message: 'zodError.socialPostTarget.platformFormatId.uuid' }),
    platform: SocialPlatformEnumSchema,
    publishFormat: SocialPublishFormatEnumSchema,
    mediaType: SocialMediaTypeEnumSchema,
    /** Per-target caption override. Null means use parent post's finalCaption. */
    captionOverride: z.string().optional(),
    /** Per-target hashtag block override. Null means use parent finalHashtagsText. */
    hashtagsOverrideText: z.string().optional(),
    /** Per-target footer override. Null means use parent post's footer. */
    footerOverride: z.string().optional(),
    /**
     * Target-level status mirrors the post pipeline but is tracked independently
     * so each platform can be in a different state.
     */
    status: SocialPostStatusEnumSchema.default(SocialPostStatusEnum.NEEDS_REVIEW),
    scheduledAt: z.coerce.date().optional(),
    publishedAt: z.coerce.date().optional(),
    /** Platform's native post identifier after successful publish */
    externalPostId: z.string().optional(),
    /** Platform's native post URL after successful publish */
    externalPostUrl: z
        .string()
        .url({ message: 'zodError.socialPostTarget.externalPostUrl.url' })
        .optional(),
    /** Make.com scenario key used for this target's dispatch */
    makeScenarioKey: z.string().optional(),
    /** ID of the last Make.com run that claimed this target */
    makeLastRunId: z.string().optional(),
    /** Full payload sent to Make.com for this target */
    makePayloadJson: z.record(z.string(), z.unknown()).optional(),
    /** Last error message from Make callback or network failure */
    lastErrorMessage: z.string().optional(),
    /** Number of dispatch retries for this specific target */
    retryCount: z.number().int().min(0).default(0),
    createdAt: z.coerce.date({ message: 'zodError.common.createdAt.required' }),
    updatedAt: z.coerce.date({ message: 'zodError.common.updatedAt.required' })
});

/** TypeScript type inferred from {@link SocialPostTargetSchema}. */
export type SocialPostTarget = z.infer<typeof SocialPostTargetSchema>;
