import type { ImageProvider } from '@repo/media';
import type { ImageCache } from './cloudinary-cache.js';
import { uploadSeedImage } from './cloudinary-upload.js';

/**
 * Parameters for {@link processEntityImages}.
 */
export interface ProcessEntityImagesParams {
    /** Raw entity data loaded from the seed JSON file. */
    readonly data: Record<string, unknown>;
    /**
     * Plural entity type name matching the seed data folder,
     * e.g. 'accommodations', 'destinations', 'events', 'posts', 'avatars'.
     */
    readonly entityType: string;
    /** Seed entity ID used as a path segment in the Cloudinary public ID. */
    readonly entityId: string;
    /**
     * Configured Cloudinary provider, or null when Cloudinary is not configured.
     * When null, the function returns the data object unchanged.
     */
    readonly provider: ImageProvider | null;
    /** Mutable in-memory cache object (keyed by Cloudinary public ID). */
    readonly cache: ImageCache;
    /** Absolute path to the cache JSON file on disk. */
    readonly cachePath: string;
    /** Environment label used in the Cloudinary folder path, e.g. 'development'. */
    readonly env: string;
}

/**
 * Internal shape for an image entry inside a `media` block.
 */
interface MediaImageEntry {
    url?: string;
    [key: string]: unknown;
}

/**
 * Internal shape for the `media` block found in most seed entities.
 */
interface MediaBlock {
    featuredImage?: MediaImageEntry;
    gallery?: MediaImageEntry[];
    [key: string]: unknown;
}

/**
 * Processes all image URLs within an entity's data and replaces them with
 * Cloudinary URLs, using the cache to avoid redundant uploads.
 *
 * Handles three image locations:
 * - `data.media.featuredImage.url`  → role `'featured'`
 * - `data.media.gallery[n].url`     → role `'0'`, `'1'`, … (index as string)
 * - `data.profile.avatar`           → role `'avatar'` (user entities)
 *
 * If `provider` is `null`, the function returns the `data` object unchanged
 * so the seed process works normally without Cloudinary configured.
 *
 * @param params - See {@link ProcessEntityImagesParams}.
 * @returns A shallow copy of `data` with image URLs replaced by Cloudinary URLs.
 *
 * @example
 * ```ts
 * const processed = await processEntityImages({
 *   data: accommodationJson,
 *   entityType: 'accommodations',
 *   entityId: '004-accommodation-colon-cabin',
 *   provider,
 *   cache,
 *   cachePath: '/path/to/.cloudinary-cache.json',
 *   env: 'development',
 * });
 * // processed.media.featuredImage.url => 'https://res.cloudinary.com/...'
 * ```
 */
export async function processEntityImages(
    params: ProcessEntityImagesParams
): Promise<Record<string, unknown>> {
    const { data, entityType, entityId, provider, cache, cachePath, env } = params;

    // No provider configured — return unchanged
    if (!provider) {
        return data;
    }

    const result: Record<string, unknown> = { ...data };

    // --- media.featuredImage ---
    const media = data.media as MediaBlock | undefined;
    if (media) {
        const updatedMedia: MediaBlock = { ...media };

        if (media.featuredImage?.url) {
            const { cloudinaryUrl } = await uploadSeedImage({
                originalUrl: media.featuredImage.url,
                entityType,
                entityId,
                role: 'featured',
                provider,
                cache,
                cachePath,
                env
            });
            updatedMedia.featuredImage = { ...media.featuredImage, url: cloudinaryUrl };
        }

        // --- media.gallery ---
        if (Array.isArray(media.gallery) && media.gallery.length > 0) {
            const updatedGallery = await Promise.all(
                media.gallery.map(async (entry, index) => {
                    if (!entry.url) return entry;
                    const { cloudinaryUrl } = await uploadSeedImage({
                        originalUrl: entry.url,
                        entityType,
                        entityId,
                        role: String(index),
                        provider,
                        cache,
                        cachePath,
                        env
                    });
                    return { ...entry, url: cloudinaryUrl };
                })
            );
            updatedMedia.gallery = updatedGallery;
        }

        result.media = updatedMedia;
    }

    // --- profile.avatar (user entities) ---
    const profile = data.profile as Record<string, unknown> | undefined;
    if (profile?.avatar && typeof profile.avatar === 'string') {
        const { cloudinaryUrl } = await uploadSeedImage({
            originalUrl: profile.avatar,
            entityType,
            entityId,
            role: 'avatar',
            provider,
            cache,
            cachePath,
            env
        });
        result.profile = { ...profile, avatar: cloudinaryUrl };
    }

    return result;
}
