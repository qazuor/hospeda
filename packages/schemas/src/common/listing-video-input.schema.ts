import { z } from 'zod';
import { ModerationStatusEnum } from '../enums/index.js';
import { mediaAssetUrl } from './media.schema.js';

/** Most linked videos a listing may carry (HOS-2258, owner decision 2026-11-18). */
export const LISTING_VIDEOS_MAX = 6;

/**
 * One video link as an owner's client submits it (HOS-2258).
 *
 * Deliberately has NO `moderationState`: the owner never decides whether their
 * own video is approved. Zod drops the key when a client sends it, and
 * {@link ListingVideosInputSchema} stamps the state on the way out.
 *
 * The provider is not validated here. As on accommodations, the server only
 * requires an http(s) URL; the list of known providers is applied when the
 * page renders (`resolveVideoEmbed`), so an unknown host is never embedded.
 */
export const ListingVideoInputSchema = z.object({
    url: mediaAssetUrl('zodError.common.media.video.url.invalid'),
    caption: z
        .string({ message: 'zodError.common.media.video.caption.required' })
        .min(3, { message: 'zodError.common.media.video.caption.min' })
        .max(100, { message: 'zodError.common.media.video.caption.max' })
        .optional()
});
export type ListingVideoInput = z.infer<typeof ListingVideoInputSchema>;

/**
 * The `videos` array of an owner write (HOS-2258): at most
 * {@link LISTING_VIDEOS_MAX} entries, each published as `APPROVED`.
 *
 * Idempotent: parsing its own output again yields the same value, which the
 * route does (route parse, then the service parses once more).
 */
export const ListingVideosInputSchema = z
    .array(ListingVideoInputSchema)
    .max(LISTING_VIDEOS_MAX, { message: 'zodError.common.media.video.list.max' })
    .transform((videos) =>
        videos.map((video) => ({ ...video, moderationState: ModerationStatusEnum.APPROVED }))
    );
