import type { ImageType, MediaType, VideoType } from '@repo/types';
import { ModerationStatusEnum as ModerationStatusEnumType } from '@repo/types';
import type { z } from 'zod';
import { normalizeAdminInfo } from '../../utils';
import type { PostCreateInput, PostUpdateSchema } from './post.schemas';

const DEFAULT_MODERATION_STATE: ModerationStatusEnumType = ModerationStatusEnumType.PENDING;

export function normalizeImage(input: unknown): ImageType | undefined {
    if (!input || typeof input !== 'object') return undefined;
    const img = input as Partial<ImageType>;
    if (!img.url || typeof img.url !== 'string') return undefined;
    return {
        url: img.url,
        caption: img.caption,
        description: img.description,
        moderationState:
            (img.moderationState as ModerationStatusEnumType) ?? DEFAULT_MODERATION_STATE,
        tags: Array.isArray(img.tags) ? img.tags : undefined
    };
}

export function normalizeMedia(input: unknown): MediaType | undefined {
    if (!input || typeof input !== 'object') return undefined;
    const media = input as Partial<MediaType>;
    const featuredImage = normalizeImage(media.featuredImage);
    if (!featuredImage) return undefined;
    return {
        featuredImage,
        gallery: Array.isArray(media.gallery)
            ? (media.gallery.map(normalizeImage).filter(Boolean) as ImageType[])
            : undefined,
        videos: Array.isArray(media.videos)
            ? (media.videos.filter((v) => v && typeof v.url === 'string') as VideoType[])
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
export function normalizeCreateInput(data: PostCreateInput): PostCreateInput {
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
        PostCreateInput,
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
    } as PostCreateInput;
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
    data: { id: string } & Partial<Omit<z.infer<typeof PostUpdateSchema>, 'id'>>
): z.infer<typeof PostUpdateSchema> {
    // If no updatable fields are present, return an empty object (homogeneous with other services)
    const { id, ...fields } = data;
    const hasUpdatableFields = Object.keys(fields).length > 0;
    if (!hasUpdatableFields) {
        return {} as z.infer<typeof PostUpdateSchema>;
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
        z.infer<typeof PostUpdateSchema>,
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
    } as z.infer<typeof PostUpdateSchema>;
}
