import { z } from 'zod';
import {
    FacebookUrlRegex,
    InstagramUrlRegex,
    LinkedInUrlRegex,
    TikTokUrlRegex,
    TwitterUrlRegex,
    YouTubeUrlRegex
} from '../utils/utils.js';

export const SocialNetworkSchema = z.object({
    facebook: z
        .string()
        .url({ message: 'zodError.common.social.facebook.invalid' })
        .regex(FacebookUrlRegex, {
            message: 'zodError.common.social.facebook.pattern'
        })
        .optional(),
    instagram: z
        .string()
        .url({ message: 'zodError.common.social.instagram.invalid' })
        .regex(InstagramUrlRegex, {
            message: 'zodError.common.social.instagram.pattern'
        })
        .optional(),
    twitter: z
        .string()
        .url({ message: 'zodError.common.social.twitter.invalid' })
        .regex(TwitterUrlRegex, {
            message: 'zodError.common.social.twitter.pattern'
        })
        .optional(),
    linkedIn: z
        .string()
        .url({ message: 'zodError.common.social.linkedIn.invalid' })
        .regex(LinkedInUrlRegex, {
            message: 'zodError.common.social.linkedIn.pattern'
        })
        .optional(),
    tiktok: z
        .string()
        .url({ message: 'zodError.common.social.tiktok.invalid' })
        .regex(TikTokUrlRegex, {
            message: 'zodError.common.social.tiktok.pattern'
        })
        .optional(),
    youtube: z
        .string()
        .url({ message: 'zodError.common.social.youtube.invalid' })
        .regex(YouTubeUrlRegex, {
            message: 'zodError.common.social.youtube.pattern'
        })
        .optional()
});
