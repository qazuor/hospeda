/**
 * Media type classifier for social media assets in the Hospeda social automation system (SPEC-254).
 *
 * Used on both `social_assets` (asset-level media kind) and `social_platform_formats`
 * (required media kind for a given platform × format combination).
 *
 * @module social-media-type.enum
 */

/**
 * All supported media type classifications for social assets and platform formats.
 *
 * @example
 * ```ts
 * import { SocialMediaTypeEnum } from '@repo/schemas';
 *
 * const mediaType: SocialMediaTypeEnum = SocialMediaTypeEnum.IMAGE;
 * ```
 */
export enum SocialMediaTypeEnum {
    /** The asset or format requires/contains a static image. */
    IMAGE = 'IMAGE',

    /** The asset or format requires/contains a video file. */
    VIDEO = 'VIDEO',

    /** No media attachment is required or present (text-only). */
    NONE = 'NONE'
}
