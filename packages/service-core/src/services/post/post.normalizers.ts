/**
 * @fileoverview Normalization functions for Post entities.
 * Contains functions to clean, validate, and standardize input data for posts,
 * including media content, images, and metadata normalization.
 */

import type {
    Image,
    Media,
    PostCreateInputSchema,
    PostUpdateInputSchema as UpdatePostInputSchema,
    Video
} from '@repo/schemas';
import { ModerationStatusEnum as ModerationStatusEnumType } from '@repo/schemas';
import type { z } from 'zod';
import { normalizeAdminInfo } from '../../utils';

const DEFAULT_MODERATION_STATE: ModerationStatusEnumType = ModerationStatusEnumType.PENDING;

/**
 * Normalizes image data for posts.
 * Validates image structure and applies default moderation status if needed.
 *
 * @param input - Raw image data (potentially malformed or incomplete)
 * @returns Normalized ImageType object or undefined if invalid
 *
 * @example
 * ```typescript
 * const image = normalizeImage({ url: 'https://example.com/image.jpg', caption: 'Test' });
 * // Returns: { url: '...', caption: 'Test', moderationState: 'PENDING', ... }
 * ```
 */
export function normalizeImage(input: unknown): Image | undefined {
    if (!input || typeof input !== 'object') return undefined;
    const img = input as Partial<Image>;
    if (!img.url || typeof img.url !== 'string') return undefined;
    return {
        url: img.url,
        caption: img.caption,
        description: img.description,
        moderationState:
            (img.moderationState as ModerationStatusEnumType) ?? DEFAULT_MODERATION_STATE
    };
}

/**
 * Normalizes media data for posts.
 * Validates media structure including featured image and gallery arrays.
 * Ensures all media content follows proper format and moderation status.
 *
 * @param input - Raw media data (potentially malformed or incomplete)
 * @returns Normalized MediaType object or undefined if invalid
 *
 * @example
 * ```typescript
 * const media = normalizeMedia({
 *   featuredImage: { url: 'featured.jpg' },
 *   gallery: [{ url: 'gallery1.jpg' }]
 * });
 * ```
 */
export function normalizeMedia(input: unknown): Media | undefined {
    if (!input || typeof input !== 'object') return undefined;
    const media = input as Partial<Media>;
    const featuredImage = normalizeImage(media.featuredImage);
    if (!featuredImage) return undefined;
    return {
        featuredImage,
        gallery: Array.isArray(media.gallery)
            ? (media.gallery.map(normalizeImage).filter(Boolean) as Image[])
            : undefined,
        videos: Array.isArray(media.videos)
            ? (media.videos.filter(
                  (v: unknown): v is Video =>
                      v != null &&
                      typeof v === 'object' &&
                      'url' in v &&
                      typeof (v as { url: unknown }).url === 'string'
              ) as Video[])
            : undefined
    };
}

/**
 * Normalizes input data for creating a post.
 * - Trims title, summary, content.
 * - If summary is empty, generates from content (first 200 chars, no word cut).
 * - Ensures media is MediaType or undefined.
 * @param data - The input data
 * @returns Normalized data
 */
export function normalizeCreateInput(
    data: z.infer<typeof PostCreateInputSchema>
): z.infer<typeof PostCreateInputSchema> {
    const title = data.title?.trim() ?? '';
    let summary = data.summary?.trim() ?? '';
    const content = data.content?.trim() ?? '';
    if (!summary && content) {
        // Generate summary from content (first 200 chars, no word cut)
        const maxLen = 200;
        if (content.length <= maxLen) {
            summary = content;
        } else {
            const cut = content.slice(0, maxLen);
            const lastSpace = cut.lastIndexOf(' ');
            summary = cut.slice(0, lastSpace > 0 ? lastSpace : maxLen);
        }
    }
    const media = normalizeMedia(data.media);
    const { adminInfo: _adminInfo, ...rest } = data as { adminInfo?: unknown } & Omit<
        z.infer<typeof PostCreateInputSchema>,
        'adminInfo'
    >;
    const adminInfo = normalizeAdminInfo(_adminInfo);
    return {
        ...rest,
        title,
        summary,
        content,
        ...(media !== undefined ? { media } : {}),
        ...(adminInfo ? { adminInfo } : {})
    } as z.infer<typeof PostCreateInputSchema>;
}

/**
 * Normalizes input data for updating a post.
 * - Trims title, summary, content if present.
 * - If summary is empty and content is present, generates from content (first 200 chars, no word cut).
 * - Sets defaults for isFeatured, isNews, isFeaturedInWebsite, likes, comments, shares if not present.
 * - Ensures media is MediaType o undefined.
 * @param data - The input data
 * @returns Normalized data
 */
export function normalizeUpdateInput(
    data: { id: string } & Partial<Omit<z.infer<typeof UpdatePostInputSchema>, 'id'>>
): z.infer<typeof UpdatePostInputSchema> {
    // If no updatable fields are present, return an empty object (homogeneous with other services)
    const { id, ...fields } = data;
    const hasUpdatableFields = Object.keys(fields).length > 0;
    if (!hasUpdatableFields) {
        return {} as z.infer<typeof UpdatePostInputSchema>;
    }
    const title = data.title?.trim();
    let summary = data.summary?.trim();
    const content = data.content?.trim();
    if ((summary === '' || summary === undefined) && content) {
        // Generate summary from content (first 200 chars, no word cut)
        const maxLen = 200;
        if (content.length <= maxLen) {
            summary = content;
        } else {
            const cut = content.slice(0, maxLen);
            const lastSpace = cut.lastIndexOf(' ');
            summary = cut.slice(0, lastSpace > 0 ? lastSpace : maxLen);
        }
    }
    const media = normalizeMedia(data.media);
    const { adminInfo: _adminInfo, ...rest } = data as { adminInfo?: unknown } & Omit<
        z.infer<typeof UpdatePostInputSchema>,
        'adminInfo'
    >;
    const adminInfo = normalizeAdminInfo(_adminInfo);
    return {
        ...rest,
        ...(title !== undefined ? { title } : {}),
        ...(summary !== undefined ? { summary } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(media !== undefined ? { media } : {}),
        ...(adminInfo ? { adminInfo } : {})
    } as z.infer<typeof UpdatePostInputSchema>;
}
