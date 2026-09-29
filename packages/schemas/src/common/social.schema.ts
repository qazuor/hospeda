import { z } from 'zod';
import {
    FacebookUrlRegex,
    InstagramUrlRegex,
    LinkedInUrlRegex,
    TikTokUrlRegex,
    TwitterUrlRegex,
    YouTubeUrlRegex
} from '../utils/utils.js';

/**
 * Social Network Schema
 * Represents social media profiles and links
 */
export const SocialNetworkSchema = z.object({
    facebook: z
        .string()
        .url({ message: 'zodError.common.social.facebook.invalid' })
        .regex(FacebookUrlRegex, {
            message: 'zodError.common.social.facebook.pattern'
        })
        .nullish(),
    instagram: z
        .string()
        .url({ message: 'zodError.common.social.instagram.invalid' })
        .regex(InstagramUrlRegex, {
            message: 'zodError.common.social.instagram.pattern'
        })
        .nullish(),
    twitter: z
        .string()
        .url({ message: 'zodError.common.social.twitter.invalid' })
        .regex(TwitterUrlRegex, {
            message: 'zodError.common.social.twitter.pattern'
        })
        .nullish(),
    linkedIn: z
        .string()
        .url({ message: 'zodError.common.social.linkedIn.invalid' })
        .regex(LinkedInUrlRegex, {
            message: 'zodError.common.social.linkedIn.pattern'
        })
        .nullish(),
    tiktok: z
        .string()
        .url({ message: 'zodError.common.social.tiktok.invalid' })
        .regex(TikTokUrlRegex, {
            message: 'zodError.common.social.tiktok.pattern'
        })
        .nullish(),
    youtube: z
        .string()
        .url({ message: 'zodError.common.social.youtube.invalid' })
        .regex(YouTubeUrlRegex, {
            message: 'zodError.common.social.youtube.pattern'
        })
        .nullish()
});
export type SocialNetwork = z.infer<typeof SocialNetworkSchema>;

/**
 * Lenient READ overlay for the `socialNetworks` JSONB column (HOS-190, HOS-302).
 *
 * Plain strings: a legacy variant URL (`m.facebook.com/...`, a bare handle, a
 * shortened link) fails the platform regex the WRITE shape enforces, and a read
 * path must never 500 on data that is already stored. Every read path that
 * surfaces it — the self access family AND the query family the admin
 * entity-list client re-parses with a fail-closed `safeParse` — must use this
 * shape.
 *
 * Lives next to {@link SocialNetworkSchema} (the WRITE shape) as the SINGLE
 * definition, mirroring `ContactInfoReadSchema` in `./contact.schema.js`. It was
 * module-private inside `user.access.schema.ts` until HOS-302, which is how the
 * query family ended up with a second, stricter idea of "lenient user".
 */
export const SocialNetworkReadSchema = z.object({
    facebook: z.string().nullish(),
    instagram: z.string().nullish(),
    twitter: z.string().nullish(),
    linkedIn: z.string().nullish(),
    tiktok: z.string().nullish(),
    youtube: z.string().nullish()
});
export type SocialNetworkRead = z.infer<typeof SocialNetworkReadSchema>;

/**
 * Social network fields (using SocialNetworkSchema structure)
 */
export const SocialNetworkFields = {
    socialNetworks: SocialNetworkSchema.nullish()
} as const;
