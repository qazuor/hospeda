/**
 * Publish format types for social media posts in the Hospeda social automation system (SPEC-254).
 *
 * Determines the content structure used when dispatching a post to a given platform
 * via Make.com. Each platform supports a subset of these formats, enforced by the
 * `social_platform_formats` configuration table.
 *
 * @module social-publish-format.enum
 */

/**
 * All supported social media publish formats.
 *
 * @example
 * ```ts
 * import { SocialPublishFormatEnum } from '@repo/schemas';
 *
 * const format: SocialPublishFormatEnum = SocialPublishFormatEnum.REEL;
 * ```
 */
export enum SocialPublishFormatEnum {
    /** Generic feed post — used for platforms that do not distinguish post sub-types. */
    FEED_POST = 'FEED_POST',

    /** Photo-only feed post (e.g., Facebook photo post). */
    PHOTO_POST = 'PHOTO_POST',

    /** Text-only post with no media attachment (e.g., X/Twitter thread). */
    TEXT_POST = 'TEXT_POST',

    /** Feed post that includes a single image (e.g., X/Twitter with image). */
    IMAGE_POST = 'IMAGE_POST',

    /** Feed post that includes a video attachment. */
    VIDEO_POST = 'VIDEO_POST',

    /** Short-form vertical video (Instagram Reels). */
    REEL = 'REEL',

    /** Ephemeral 24-hour story format (Instagram / Facebook Stories). */
    STORY = 'STORY',

    /** Multi-image slideshow carousel (Instagram Carousel). */
    CAROUSEL = 'CAROUSEL'
}
