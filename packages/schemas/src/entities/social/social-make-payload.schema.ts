/**
 * @file social-make-payload.schema.ts
 *
 * Zod schema and inferred TypeScript type for the Make.com dispatch payload
 * built by `SocialPublishDispatchService.buildMakePayload`.
 *
 * This schema is the single source of truth for the payload shape. Both the
 * service layer and any future consumers (route handlers, tests) must import
 * the type from here rather than defining it independently.
 *
 * @see SPEC-254 US-11, T-044
 */

import { z } from 'zod';

/**
 * Payload object sent to the Make.com webhook for each qualifying target.
 *
 * Fields map 1-to-1 to the spec US-11 dispatch shape:
 * - Routing fields (`platform`, `publishFormat`, `makeChannelKey`)
 * - Content fields (`captionFinal`, `hashtagsFinal`, `footerFinal`, `mediaUrls`)
 * - Scheduling fields (`scheduledAt`, `timezone`)
 * - Callback URLs (`callbackClaimUrl`, `callbackResultUrl`)
 */
export const SocialMakePayloadSchema = z.object({
    /** UUID of the `social_post_targets` row being dispatched. */
    targetId: z.string().uuid(),
    /** UUID of the parent `social_posts` row. */
    postId: z.string().uuid(),
    /**
     * Platform identifier (e.g. `INSTAGRAM`, `FACEBOOK`).
     * Sourced from the target's associated `social_platform_formats.platform` column.
     */
    platform: z.string().min(1),
    /**
     * Publish format (e.g. `FEED_POST`, `REEL`).
     * Sourced from `social_post_targets.publish_format`.
     */
    publishFormat: z.string().min(1),
    /**
     * Make.com channel routing key (e.g. `instagram-feed`).
     * Sourced from `social_platform_formats.make_channel_key`.
     * Null when the platform-format has no channel key configured yet.
     */
    makeChannelKey: z.string().nullable(),
    /**
     * Final assembled caption for this post.
     * Prefers `social_posts.final_caption`; falls back to `social_posts.caption_base`.
     */
    captionFinal: z.string(),
    /**
     * Final hashtag block as a single text string.
     * Empty string when the post has no hashtags.
     */
    hashtagsFinal: z.string(),
    /**
     * Resolved footer content for this post.
     * Empty string when the post has no footer (`footer_id` is null).
     */
    footerFinal: z.string(),
    /**
     * Ordered list of Cloudinary delivery URLs for the post's media assets.
     * Ordered by `social_post_media.position` ascending (carousel order).
     * Only non-null cloudinary URLs are included.
     */
    mediaUrls: z.array(z.string().url()),
    /**
     * UTC timestamp at which the post is scheduled to publish.
     * Null for posts in READY_TO_PUBLISH state (immediate dispatch).
     */
    scheduledAt: z.date().nullable(),
    /**
     * IANA timezone string for the post (e.g. `America/Argentina/Buenos_Aires`).
     */
    timezone: z.string().min(1),
    /**
     * URL Make.com must POST to with `{ makeRunId }` to claim this dispatch job.
     * Pattern: `${apiBaseUrl}/api/v1/integrations/make/social/jobs/${targetId}/claim`
     */
    callbackClaimUrl: z.string().url(),
    /**
     * URL Make.com must POST to with the publish result to complete this job.
     * Pattern: `${apiBaseUrl}/api/v1/integrations/make/social/jobs/${targetId}/result`
     */
    callbackResultUrl: z.string().url()
});

/**
 * TypeScript type inferred from {@link SocialMakePayloadSchema}.
 *
 * @example
 * ```ts
 * import { SocialMakePayloadSchema } from '@repo/schemas';
 * import type { SocialMakePayload } from '@repo/schemas';
 *
 * const payload: SocialMakePayload = { targetId: '...', ... };
 * SocialMakePayloadSchema.parse(payload); // runtime validation
 * ```
 */
export type SocialMakePayload = z.infer<typeof SocialMakePayloadSchema>;
