/**
 * Origin source for social media assets in the Hospeda social automation system (SPEC-254).
 *
 * Identifies how a media asset was ingested into the `social_assets` table,
 * enabling audit trails and determining what metadata fields are expected
 * (e.g., `openai_file_ref` is only set for `CHATGPT_FILE` assets).
 *
 * @module social-asset-source.enum
 */

/**
 * All possible origin sources for a social media asset.
 *
 * @example
 * ```ts
 * import { SocialAssetSourceEnum } from '@repo/schemas';
 *
 * const assetSource: SocialAssetSourceEnum = SocialAssetSourceEnum.CLOUDINARY;
 * ```
 */
export enum SocialAssetSourceEnum {
    /** Asset was provided by the Custom GPT as an OpenAI file reference and downloaded from OpenAI. */
    CHATGPT_FILE = 'CHATGPT_FILE',

    /** Asset was retrieved directly from Cloudinary using an existing public ID. */
    CLOUDINARY = 'CLOUDINARY',

    /** Asset was uploaded manually by an admin user through the admin dashboard. */
    MANUAL_UPLOAD = 'MANUAL_UPLOAD',

    /** Asset was ingested from an external URL (e.g., `image.mode = "public_url"` in GPT payload). */
    EXTERNAL_URL = 'EXTERNAL_URL'
}
