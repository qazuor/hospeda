/**
 * Utility functions for extracting media URLs from API response objects.
 *
 * API responses store images in a nested `media` JSONB structure:
 * `{ media: { featuredImage: { url, caption }, gallery: [...] } }`
 *
 * These helpers extract the plain URL string and apply Cloudinary transforms
 * via `getMediaUrl()` from `@repo/media`. Non-Cloudinary URLs pass through unchanged.
 *
 * Note: the API may attach a `moderationState` on each image but that field is
 * an admin-only concern. Moderation filtering happens on the server — public
 * web responses only ever include approved assets, so this file ignores the
 * field entirely. See SPEC-078-GAPS T-049 (GAP-078-064).
 */

import { getMediaUrl } from '@repo/media';
import type { MediaPreset } from '@repo/media';

const DEFAULT_PLACEHOLDER = '/images/placeholder.svg';

interface MediaImage {
    readonly url?: string;
    readonly caption?: string;
    readonly description?: string;
}

interface MediaObject {
    readonly featuredImage?: MediaImage | string;
    readonly gallery?: readonly MediaImage[];
    readonly videos?: readonly { readonly url?: string }[];
}

/**
 * A gallery item carrying the transformed image URL plus any caption and
 * description metadata attached to it on the API side.
 *
 * Produced by {@link extractGalleryItems}. Components that render captions
 * (HeroGallery, full photo page) should consume this shape; components that
 * only need the URL list can keep using {@link extractGalleryUrls}.
 */
export interface GalleryItem {
    readonly url: string;
    readonly caption?: string;
    readonly description?: string;
}

/**
 * Options bag for {@link extractFeaturedImageUrl}.
 *
 * Allows callers to express fallback and preset as a named-argument object
 * instead of positional parameters.  When `options.fallback` is provided it
 * takes precedence over the positional `fallback` parameter, enabling call
 * sites to opt into the options pattern incrementally (GAP-078-061 follow-up
 * from SPEC-078-GAPS T-042 / T-049).
 */
export interface ExtractFeaturedImageOptions {
    /** Fallback URL returned when no image field is found on the item. */
    readonly fallback?: string;
    /** Named Cloudinary preset to apply. */
    readonly preset?: MediaPreset;
}

/**
 * Extracts the featured image URL from an API response item and applies
 * a Cloudinary transform preset via `getMediaUrl()`.
 *
 * Handles both nested media objects and flat string values.
 * Non-Cloudinary URLs pass through `getMediaUrl()` unchanged.
 *
 * The positional `fallback` and `preset` parameters are preserved for
 * backward compatibility.  When `options.fallback` or `options.preset` are
 * provided they take precedence over the positional equivalents.
 *
 * @param item - API response item (destination, accommodation, event, post, etc.)
 * @param fallback - Fallback URL if no image is found (default: `'/images/placeholder.svg'`)
 * @param preset - Named Cloudinary preset to apply (default: `'card'`)
 * @param options - Optional named-argument overrides for `fallback` and `preset`
 * @returns The transformed image URL string
 */
export function extractFeaturedImageUrl(
    item: Record<string, unknown>,
    fallback = DEFAULT_PLACEHOLDER,
    preset: MediaPreset = 'card',
    options?: ExtractFeaturedImageOptions
): string {
    const resolvedFallback = options?.fallback ?? fallback;
    const resolvedPreset = options?.preset ?? preset;

    const media = item.media as MediaObject | undefined;
    if (media?.featuredImage) {
        if (typeof media.featuredImage === 'string') {
            return getMediaUrl(media.featuredImage, { preset: resolvedPreset });
        }
        if (typeof media.featuredImage === 'object' && media.featuredImage.url) {
            return getMediaUrl(media.featuredImage.url, { preset: resolvedPreset });
        }
    }

    if (typeof item.featuredImage === 'string' && item.featuredImage) {
        return getMediaUrl(item.featuredImage, { preset: resolvedPreset });
    }

    if (typeof item.heroImage === 'string' && item.heroImage) {
        return getMediaUrl(item.heroImage, { preset: resolvedPreset });
    }

    if (typeof item.image === 'string' && item.image) {
        return getMediaUrl(item.image, { preset: resolvedPreset });
    }

    return resolvedFallback;
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

/**
 * Extracts gallery items (url + caption + description) from an API response
 * item and applies a Cloudinary transform preset to each URL.
 *
 * Unlike {@link extractGalleryUrls}, this function preserves the `caption` and
 * `description` metadata attached to each gallery entry on the API side.
 * Consumers that need to surface captions (for example HeroGallery's
 * GLightbox integration) should use this helper.
 *
 * Non-Cloudinary URLs pass through `getMediaUrl()` unchanged.
 *
 * @param item - API response item
 * @param preset - Named Cloudinary preset to apply (default: `'gallery'`)
 * @returns Array of gallery items with transformed URLs and preserved metadata
 */
export function extractGalleryItems(
    item: Record<string, unknown>,
    preset: MediaPreset = 'gallery'
): readonly GalleryItem[] {
    const media = item.media as MediaObject | undefined;
    if (!media?.gallery || !Array.isArray(media.gallery)) {
        return [];
    }

    return media.gallery
        .map((entry) => {
            if (typeof entry === 'string') {
                return entry ? { url: getMediaUrl(entry, { preset }) } : null;
            }
            if (!entry || typeof entry.url !== 'string' || entry.url.length === 0) {
                return null;
            }
            const item: {
                url: string;
                caption?: string;
                description?: string;
            } = { url: getMediaUrl(entry.url, { preset }) };
            if (typeof entry.caption === 'string' && entry.caption.length > 0) {
                item.caption = entry.caption;
            }
            if (typeof entry.description === 'string' && entry.description.length > 0) {
                item.description = entry.description;
            }
            return item;
        })
        .filter((item): item is GalleryItem => item !== null);
}
