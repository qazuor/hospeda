/**
 * Social media platform identifiers for the Hospeda social automation system (SPEC-254).
 *
 * Represents each external publishing platform that posts can be dispatched to
 * via Make.com. Each value maps directly to a row in `social_platforms`.
 *
 * @module social-platform.enum
 */

/**
 * All supported social media publishing platforms.
 *
 * @example
 * ```ts
 * import { SocialPlatformEnum } from '@repo/schemas';
 *
 * const platform: SocialPlatformEnum = SocialPlatformEnum.INSTAGRAM;
 * ```
 */
export enum SocialPlatformEnum {
    /** Instagram — supports FEED_POST, REEL, STORY, CAROUSEL formats. */
    INSTAGRAM = 'INSTAGRAM',

    /** Facebook — supports FEED_POST, PHOTO_POST, VIDEO_POST, STORY formats. */
    FACEBOOK = 'FACEBOOK',

    /** X (formerly Twitter) — supports TEXT_POST, IMAGE_POST, VIDEO_POST formats. */
    X = 'X'
}
