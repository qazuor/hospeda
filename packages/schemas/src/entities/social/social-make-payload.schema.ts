/**
 * @file social-make-payload.schema.ts
 *
 * Zod schemas and inferred TypeScript types for the Make.com integration:
 *  - {@link SocialMakePayloadSchema} — outbound dispatch payload sent to the
 *    Make.com webhook via HTTP POST.
 *  - {@link MakeWebhookResponseSchema} — synchronous response body returned by
 *    the Make.com "Webhook Response" module in the same HTTP round-trip.
 *
 * This file is the single source of truth for both shapes. Service layer and
 * tests must import from here, never define locally.
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
 *
 * The async callback URLs (`callbackClaimUrl`, `callbackResultUrl`) have been
 * removed: Make.com now responds synchronously via the "Webhook Response"
 * module in the same HTTP round-trip, so Hospeda no longer needs to receive
 * callbacks and Make.com no longer needs to know Hospeda's URL.
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
    timezone: z.string().min(1)
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

// ---------------------------------------------------------------------------
// Synchronous Make.com webhook response schema
// ---------------------------------------------------------------------------

/**
 * Body returned by Make.com's "Webhook Response" module in the same HTTP
 * round-trip as the dispatch POST.
 *
 * Make.com replies with HTTP 200 and one of two shapes:
 * - SUCCESS: `{ "status": "SUCCESS", "externalPostId": "...", "externalPostUrl": "..." }`
 * - FAILED:  `{ "status": "FAILED", "errorMessage": "..." }`
 *
 * All fields except `status` are optional to handle partial Make.com responses
 * gracefully; the service validates the discriminant and treats missing optional
 * fields as null/undefined.
 */
export const MakeWebhookResponseSchema = z.discriminatedUnion('status', [
    z.object({
        /** Indicates the social post was published successfully. */
        status: z.literal('SUCCESS'),
        /**
         * Platform-specific post identifier returned by the social network.
         * May be absent if Make.com's flow does not surface it.
         */
        externalPostId: z.string().optional(),
        /**
         * Public URL of the published post on the social network.
         * May be absent if the platform does not return it immediately.
         */
        externalPostUrl: z.string().optional()
    }),
    z.object({
        /** Indicates Make.com failed to publish the post. */
        status: z.literal('FAILED'),
        /**
         * Human-readable description of the failure from Make.com.
         * May be absent; the service falls back to a generic message.
         */
        errorMessage: z.string().optional()
    })
]);

/**
 * TypeScript type inferred from {@link MakeWebhookResponseSchema}.
 *
 * @example
 * ```ts
 * import { MakeWebhookResponseSchema } from '@repo/schemas';
 * import type { MakeWebhookResponse } from '@repo/schemas';
 *
 * const raw = await response.json();
 * const parsed = MakeWebhookResponseSchema.safeParse(raw);
 * if (parsed.success && parsed.data.status === 'SUCCESS') {
 *   console.log(parsed.data.externalPostId);
 * }
 * ```
 */
export type MakeWebhookResponse = z.infer<typeof MakeWebhookResponseSchema>;
