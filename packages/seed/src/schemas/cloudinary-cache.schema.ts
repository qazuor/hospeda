import { z } from 'zod';

/**
 * Current persisted cache schema version.
 *
 * Bump this integer when the cache file shape changes in a
 * backwards-incompatible way. Readers reject any file with a different
 * `version` (warning, not throw) and continue with an empty cache.
 */
export const CLOUDINARY_CACHE_VERSION = 1 as const;

/**
 * Zod schema for a single cache entry (one uploaded image).
 *
 * Mirrors the runtime `CacheEntry` interface in
 * `packages/seed/src/utils/cloudinary-cache.ts`. Kept in sync manually — if
 * you add a field here, update the runtime interface too (and vice versa).
 */
export const cacheEntrySchema = z.object({
    /** Original source URL (Unsplash/Pexels/etc.). */
    originalUrl: z.string().min(1),
    /** Resulting Cloudinary URL after upload. */
    cloudinaryUrl: z.string().min(1),
    /** ISO 8601 timestamp of the upload. */
    uploadedAt: z.string().min(1),
    /**
     * Last modification time of the local file source, or `null` for
     * URL-sourced images. Accepts either `null` or a non-empty string.
     */
    fileModifiedAt: z.union([z.string().min(1), z.null()])
});

/**
 * Zod schema for the full persisted cache file.
 *
 * Shape:
 * ```json
 * {
 *   "version": 1,
 *   "entries": {
 *     "hospeda/.../publicId": { originalUrl, cloudinaryUrl, uploadedAt, fileModifiedAt }
 *   }
 * }
 * ```
 *
 * Unknown top-level keys are stripped (default Zod behavior). A file with a
 * different `version` literal fails parsing and is rejected by the reader.
 */
export const cloudinaryCacheFileSchema = z.object({
    version: z.literal(CLOUDINARY_CACHE_VERSION),
    entries: z.record(z.string(), cacheEntrySchema)
});

/** Inferred TypeScript type for a validated cache entry. */
export type CacheEntrySchema = z.infer<typeof cacheEntrySchema>;

/** Inferred TypeScript type for the full persisted cache file. */
export type CloudinaryCacheFile = z.infer<typeof cloudinaryCacheFileSchema>;
