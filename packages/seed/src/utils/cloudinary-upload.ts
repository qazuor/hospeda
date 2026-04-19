import type { ImageProvider } from '@repo/media/server';
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
    /** Role within the entity, e.g. 'featured', 'gallery/0', 'gallery/1', 'avatar'. */
    readonly role: string;
    /** Configured Cloudinary provider instance. */
    readonly provider: ImageProvider;
    /** Mutable in-memory cache object (keyed by Cloudinary public ID). */
    readonly cache: ImageCache;
    /** Absolute path to the cache JSON file on disk. */
    readonly cachePath: string;
    /** Environment label used in the Cloudinary folder path, e.g. 'dev'. */
    readonly env: string;
    /**
     * When `true`, fetch/upload failures throw instead of returning a
     * `failed` outcome. Used by the required-track pipeline when the caller
     * did NOT pass `--allow-required-fallback`.
     * @default false
     */
    readonly throwOnFailure?: boolean;
    /**
     * Optional override for the full Cloudinary public ID. When provided, the
     * standard `hospeda/{env}/seed/{entityType}/{entityId}/{role}` construction
     * is bypassed and this value is used verbatim as the public ID.
     *
     * Used by the avatar pipeline (SPEC-078-GAPS T-023) which requires a flat
     * path of `hospeda/{env}/seed/avatars/{userId}` with no `role` suffix
     * (REQ-02).
     */
    readonly publicIdOverride?: string;
}

/**
 * Discriminated outcome of a seed image upload. Encodes cache hits, fresh
 * uploads, and failures so callers can drive counters and fallback logic.
 */
export type UploadSeedImageOutcome =
    | {
          readonly status: 'uploaded';
          readonly cloudinaryUrl: string;
      }
    | {
          readonly status: 'cached';
          readonly cloudinaryUrl: string;
      }
    | {
          readonly status: 'failed';
          readonly cloudinaryUrl: string;
          readonly errorMessage?: string;
      };

/**
 * Uploads a seed image to Cloudinary, using the cache to avoid re-uploads.
 *
 * The Cloudinary public ID is built as:
 *   `hospeda/{env}/seed/{entityType}/{entityId}/{role}`
 *
 * On cache hit (same original URL already uploaded), returns a `cached`
 * outcome immediately without making any network request.
 *
 * On fetch or upload failure:
 * - If `throwOnFailure` is `true`, throws the underlying error so the caller
 *   can abort the seed (loud failure for required-track jobs).
 * - Otherwise, logs a warning and returns a `failed` outcome carrying the
 *   original URL as `cloudinaryUrl`.
 *
 * @param input - Upload parameters. See {@link UploadSeedImageInput}.
 * @returns Resolved {@link UploadSeedImageOutcome}.
 *
 * @example
 * ```ts
 * const outcome = await uploadSeedImage({
 *   originalUrl: 'https://images.pexels.com/photos/123/pexels-photo-123.jpeg',
 *   entityType: 'accommodations',
 *   entityId: '004-accommodation-colon-cabin',
 *   role: 'featured',
 *   provider,
 *   cache,
 *   cachePath: '/path/to/.cloudinary-cache.json',
 *   env: 'dev',
 * });
 * if (outcome.status === 'uploaded') {
 *   // fresh upload
 * }
 * ```
 */
export async function uploadSeedImage(
    input: UploadSeedImageInput
): Promise<UploadSeedImageOutcome> {
    const {
        originalUrl,
        entityType,
        entityId,
        role,
        provider,
        cache,
        cachePath,
        env,
        throwOnFailure = false,
        publicIdOverride
    } = input;

    // Build the full Cloudinary public ID. The avatar pipeline (T-023) supplies
    // a flat-path override (`hospeda/{env}/seed/avatars/{userId}`) per REQ-02.
    const fullPublicId =
        publicIdOverride ?? `hospeda/${env}/seed/${entityType}/${entityId}/${role}`;

    // Derive folder and filename from the full public ID
    const lastSlash = fullPublicId.lastIndexOf('/');
    const folder = fullPublicId.substring(0, lastSlash);
    const publicIdSegment = fullPublicId.substring(lastSlash + 1);

    // Cache hit check — skip upload if same URL was already processed
    if (isCacheHit({ cacheEntry: cache[fullPublicId], currentUrl: originalUrl })) {
        const cachedUrl = cache[fullPublicId]?.cloudinaryUrl ?? originalUrl;
        return { status: 'cached', cloudinaryUrl: cachedUrl };
    }

    try {
        // Fetch the original image
        const response = await fetch(originalUrl);
        if (!response.ok) {
            const message = `Failed to fetch image (${response.status}): ${originalUrl}`;
            if (throwOnFailure) {
                throw new Error(message);
            }
            logger.warn(`[seed:images] ${message} — using original URL`);
            return { status: 'failed', cloudinaryUrl: originalUrl, errorMessage: message };
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

        return { status: 'uploaded', cloudinaryUrl: uploadResult.url };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (throwOnFailure) {
            throw error instanceof Error ? error : new Error(message);
        }
        logger.warn(
            `[seed:images] Upload failed for ${fullPublicId}: ${message} — using original URL`
        );
        return { status: 'failed', cloudinaryUrl: originalUrl, errorMessage: message };
    }
}
