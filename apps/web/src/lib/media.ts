/**
 * Utility functions for extracting media URLs from API response objects.
 *
 * API responses store images in a nested `media` JSONB structure:
 * `{ media: { featuredImage: { url, caption, moderationState }, gallery: [...] } }`
 *
 * These helpers extract the plain URL string and apply Cloudinary transforms
 * via `getMediaUrl()` from `@repo/media`. Non-Cloudinary URLs pass through unchanged.
 */

import { getMediaUrl } from '@repo/media';
import type { MediaPreset } from '@repo/media';

const DEFAULT_PLACEHOLDER = '/images/placeholder.svg';

interface MediaImage {
    readonly url?: string;
    readonly caption?: string;
    readonly moderationState?: string;
}

interface MediaObject {
    readonly featuredImage?: MediaImage | string;
    readonly gallery?: readonly MediaImage[];
    readonly videos?: readonly { readonly url?: string }[];
}

/**
 * Extracts the featured image URL from an API response item and applies
 * a Cloudinary transform preset via `getMediaUrl()`.
 *
 * Handles both nested media objects and flat string values.
 * Non-Cloudinary URLs pass through `getMediaUrl()` unchanged.
 *
 * @param item - API response item (destination, accommodation, event, post, etc.)
 * @param fallback - Fallback URL if no image is found
 * @param preset - Named Cloudinary preset to apply (default: `'card'`)
 * @returns The transformed image URL string
 */
export function extractFeaturedImageUrl(
    item: Record<string, unknown>,
    fallback = DEFAULT_PLACEHOLDER,
    preset: MediaPreset = 'card'
): string {
    const media = item.media as MediaObject | undefined;
    if (media?.featuredImage) {
        if (typeof media.featuredImage === 'string') {
            return getMediaUrl(media.featuredImage, { preset });
        }
        if (typeof media.featuredImage === 'object' && media.featuredImage.url) {
            return getMediaUrl(media.featuredImage.url, { preset });
        }
    }

    if (typeof item.featuredImage === 'string' && item.featuredImage) {
        return getMediaUrl(item.featuredImage, { preset });
    }

    if (typeof item.heroImage === 'string' && item.heroImage) {
        return getMediaUrl(item.heroImage, { preset });
    }

    if (typeof item.image === 'string' && item.image) {
        return getMediaUrl(item.image, { preset });
    }

    return fallback;
}

/**
 * Extracts gallery image URLs from an API response item and applies
 * a Cloudinary transform preset via `getMediaUrl()` to each URL.
 *
 * Non-Cloudinary URLs pass through `getMediaUrl()` unchanged.
 *
 * @param item - API response item
 * @param preset - Named Cloudinary preset to apply (default: `'gallery'`)
 * @returns Array of transformed image URL strings
 */
export function extractGalleryUrls(
    item: Record<string, unknown>,
    preset: MediaPreset = 'gallery'
): readonly string[] {
    const media = item.media as MediaObject | undefined;
    if (!media?.gallery || !Array.isArray(media.gallery)) {
        return [];
    }

    return media.gallery
        .map((img) => (typeof img === 'string' ? img : img?.url))
        .filter((url): url is string => typeof url === 'string' && url.length > 0)
        .map((url) => getMediaUrl(url, { preset }));
}
