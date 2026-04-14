import type { ImageProvider } from '@repo/media';
import { type ImageCache, isCacheHit, updateCacheEntry } from './cloudinary-cache.js';
import { logger } from './logger.js';

/**
 * Input parameters for uploading a single seed image to Cloudinary.
 */
export interface UploadSeedImageInput {
    /** Original source URL (Unsplash/Pexels or any HTTP URL). */
    readonly originalUrl: string;
    /** Entity type folder segment, e.g. 'accommodations', 'destinations', 'events'. */
    readonly entityType: string;
    /** Seed entity ID, e.g. '004-accommodation-colon-cabin-cabana-del-rio-colon'. */
    readonly entityId: string;
    /** Role within the entity, e.g. 'featured', '0', '1', '2'. */
    readonly role: string;
    /** Configured Cloudinary provider instance. */
    readonly provider: ImageProvider;
    /** Mutable in-memory cache object (keyed by Cloudinary public ID). */
    readonly cache: ImageCache;
    /** Absolute path to the cache JSON file on disk. */
    readonly cachePath: string;
    /** Environment label used in the Cloudinary folder path, e.g. 'development'. */
    readonly env: string;
}

/**
 * Result of a seed image upload operation.
 */
export interface UploadSeedImageResult {
    /** Final Cloudinary URL (or original URL on error / cache hit). */
    readonly cloudinaryUrl: string;
    /** Whether the URL was served from the local cache without a new upload. */
    readonly fromCache: boolean;
}

/**
 * Uploads a seed image to Cloudinary, using the cache to avoid re-uploads.
 *
 * The Cloudinary public ID is built as:
 *   `hospeda/{env}/seed/{entityType}/{entityId}/{role}`
 *
 * On cache hit (same original URL already uploaded), returns the cached URL
 * immediately without making any network request.
 *
 * On fetch or upload failure, logs a warning and returns the original URL so
 * the seed process continues without interruption.
 *
 * @param input - Upload parameters. See {@link UploadSeedImageInput}.
 * @returns Resolved upload result with the final URL and cache flag.
 *
 * @example
 * ```ts
 * const result = await uploadSeedImage({
 *   originalUrl: 'https://images.pexels.com/photos/123/pexels-photo-123.jpeg',
 *   entityType: 'accommodations',
 *   entityId: '004-accommodation-colon-cabin',
 *   role: 'featured',
 *   provider,
 *   cache,
 *   cachePath: '/path/to/.cloudinary-cache.json',
 *   env: 'development',
 * });
 * // result.cloudinaryUrl => 'https://res.cloudinary.com/...'
 * // result.fromCache     => false (first time)
 * ```
 */
export async function uploadSeedImage(input: UploadSeedImageInput): Promise<UploadSeedImageResult> {
    const { originalUrl, entityType, entityId, role, provider, cache, cachePath, env } = input;

    // Build the full Cloudinary public ID
    const fullPublicId = `hospeda/${env}/seed/${entityType}/${entityId}/${role}`;

    // Derive folder and filename from the full public ID
    const lastSlash = fullPublicId.lastIndexOf('/');
    const folder = fullPublicId.substring(0, lastSlash);
    const publicIdSegment = fullPublicId.substring(lastSlash + 1);

    // Cache hit check — skip upload if same URL was already processed
    if (isCacheHit({ cacheEntry: cache[fullPublicId], currentUrl: originalUrl })) {
        const cachedUrl = cache[fullPublicId]?.cloudinaryUrl ?? originalUrl;
        return { cloudinaryUrl: cachedUrl, fromCache: true };
    }

    try {
        // Fetch the original image
        const response = await fetch(originalUrl);
        if (!response.ok) {
            logger.warn(
                `[seed:images] Failed to fetch image (${response.status}): ${originalUrl} — using original URL`
            );
            return { cloudinaryUrl: originalUrl, fromCache: false };
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        // Upload to Cloudinary
        const uploadResult = await provider.upload({
            file: buffer,
            folder,
            publicId: publicIdSegment
        });

        // Persist to cache
        updateCacheEntry({
            cache: cache as Record<string, import('./cloudinary-cache.js').CacheEntry>,
            cachePath,
            publicId: fullPublicId,
            originalUrl,
            cloudinaryUrl: uploadResult.url,
            fileModifiedAt: null
        });

        return { cloudinaryUrl: uploadResult.url, fromCache: false };
    } catch (error) {
        logger.warn(
            `[seed:images] Upload failed for ${fullPublicId}: ${error instanceof Error ? error.message : String(error)} — using original URL`
        );
        return { cloudinaryUrl: originalUrl, fromCache: false };
    }
}
