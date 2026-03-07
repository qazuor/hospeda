/**
 * Utility functions for extracting media URLs from API response objects.
 *
 * API responses store images in a nested `media` JSONB structure:
 * `{ media: { featuredImage: { url, caption, moderationState }, gallery: [...] } }`
 *
 * These helpers extract the plain URL string for use in `<img>` tags.
 */

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
 * Extracts the featured image URL from an API response item.
 * Handles both nested media objects and flat string values.
 *
 * @param item - API response item (destination, accommodation, event, post, etc.)
 * @param fallback - Fallback URL if no image is found
 * @returns The image URL string
 */
export function extractFeaturedImageUrl(
    item: Record<string, unknown>,
    fallback = DEFAULT_PLACEHOLDER
): string {
    const media = item.media as MediaObject | undefined;
    if (media?.featuredImage) {
        if (typeof media.featuredImage === 'string') {
            return media.featuredImage;
        }
        if (typeof media.featuredImage === 'object' && media.featuredImage.url) {
            return media.featuredImage.url;
        }
    }

    if (typeof item.featuredImage === 'string' && item.featuredImage) {
        return item.featuredImage;
    }

    if (typeof item.heroImage === 'string' && item.heroImage) {
        return item.heroImage;
    }

    if (typeof item.image === 'string' && item.image) {
        return item.image;
    }

    return fallback;
}

/**
 * Extracts gallery image URLs from an API response item.
 *
 * @param item - API response item
 * @returns Array of image URL strings
 */
export function extractGalleryUrls(item: Record<string, unknown>): readonly string[] {
    const media = item.media as MediaObject | undefined;
    if (!media?.gallery || !Array.isArray(media.gallery)) {
        return [];
    }

    return media.gallery
        .map((img) => (typeof img === 'string' ? img : img?.url))
        .filter((url): url is string => typeof url === 'string' && url.length > 0);
}
