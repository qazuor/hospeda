import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Default cache file path, relative to this module's location. */
export const DEFAULT_CACHE_PATH = join(
    dirname(new URL(import.meta.url).pathname),
    '../../.cloudinary-cache.json'
);

/**
 * A single cache entry tracking an uploaded image.
 */
export interface CacheEntry {
    /** Original source URL (Unsplash/Pexels). */
    readonly originalUrl: string;
    /** Resulting Cloudinary URL after upload. */
    readonly cloudinaryUrl: string;
    /** ISO 8601 timestamp of the upload. */
    readonly uploadedAt: string;
    /** Last modification time of local file source, or null for URL sources. */
    readonly fileModifiedAt: string | null;
}

/**
 * The full cache structure, keyed by Cloudinary public ID.
 */
export type ImageCache = Record<string, CacheEntry>;

/**
 * Reads the image cache from disk.
 * Returns an empty cache if the file does not exist or is corrupted.
 *
 * @param cachePath - Absolute path to the cache JSON file
 * @returns Parsed cache object, or empty object on missing/corrupt file
 *
 * @example
 * ```ts
 * const cache = readCache('/path/to/.cloudinary-cache.json');
 * // cache is {} on first run (no file)
 * ```
 */
export function readCache(cachePath: string): ImageCache {
    try {
        const content = readFileSync(cachePath, 'utf-8');
        const parsed: unknown = JSON.parse(content);

        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            console.warn('[seed] Cache file corrupted, starting fresh');
            deleteCache(cachePath);
            return {};
        }

        return parsed as ImageCache;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return {};
        }
        console.warn('[seed] Cache file corrupted, starting fresh');
        try {
            deleteCache(cachePath);
        } catch {
            // ignore secondary errors during cleanup
        }
        return {};
    }
}

/**
 * Writes the cache to disk atomically (write to a temp file, then rename).
 * This prevents corruption if the process is killed mid-write.
 *
 * @param cachePath - Absolute path to the destination cache JSON file
 * @param cache - Cache object to persist
 *
 * @example
 * ```ts
 * writeCache('/path/to/.cloudinary-cache.json', { 'my/public-id': { ... } });
 * ```
 */
export function writeCache(cachePath: string, cache: ImageCache): void {
    const dir = dirname(cachePath);
    const tmpFile = join(dir, `.cloudinary-cache-${Date.now()}.tmp`);
    writeFileSync(tmpFile, JSON.stringify(cache, null, 2), 'utf-8');
    renameSync(tmpFile, cachePath);
}

/**
 * Deletes the cache file if it exists.
 * Silently succeeds when the file is already absent.
 *
 * @param cachePath - Absolute path to the cache JSON file
 *
 * @example
 * ```ts
 * deleteCache('/path/to/.cloudinary-cache.json');
 * ```
 */
export function deleteCache(cachePath: string): void {
    try {
        unlinkSync(cachePath);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
    }
}

/** Input parameters for {@link isCacheHit}. */
export interface IsCacheHitParams {
    /** The cache entry to evaluate, or undefined if no entry exists. */
    readonly cacheEntry: CacheEntry | undefined;
    /**
     * Current source URL for URL-based images.
     * Provide this OR `currentFileMtime`, not both.
     */
    readonly currentUrl?: string;
    /**
     * Current file modification time for local-file-based images.
     * Provide this OR `currentUrl`, not both.
     */
    readonly currentFileMtime?: string | null;
}

/**
 * Determines whether a cache entry is still valid (cache hit).
 *
 * - For URL sources: hit when `originalUrl` matches `currentUrl`.
 * - For local file sources: hit when `fileModifiedAt` matches `currentFileMtime`.
 * - Returns false when no entry exists.
 *
 * @param params - See {@link IsCacheHitParams}
 * @returns true if the entry is valid and can be reused
 *
 * @example
 * ```ts
 * const hit = isCacheHit({ cacheEntry: entry, currentUrl: 'https://unsplash.com/...' });
 * if (hit) { use entry.cloudinaryUrl directly }
 * ```
 */
export function isCacheHit(params: IsCacheHitParams): boolean {
    const { cacheEntry, currentUrl, currentFileMtime } = params;

    if (!cacheEntry) return false;

    if (currentUrl !== undefined) {
        return cacheEntry.originalUrl === currentUrl;
    }

    if (currentFileMtime !== undefined) {
        return cacheEntry.fileModifiedAt === currentFileMtime;
    }

    return false;
}

/** Input parameters for {@link updateCacheEntry}. */
export interface UpdateCacheEntryParams {
    /** Mutable cache object to update in-place. */
    readonly cache: ImageCache;
    /** Absolute path to the cache JSON file. */
    readonly cachePath: string;
    /** Cloudinary public ID (used as the cache key). */
    readonly publicId: string;
    /** Original source URL of the image. */
    readonly originalUrl: string;
    /** Resulting Cloudinary URL after upload. */
    readonly cloudinaryUrl: string;
    /**
     * Last modification time of the local file source.
     * Pass null or omit for URL-sourced images.
     */
    readonly fileModifiedAt?: string | null;
}

/**
 * Updates a single entry in the cache object and persists it to disk atomically.
 *
 * @param params - See {@link UpdateCacheEntryParams}
 *
 * @example
 * ```ts
 * updateCacheEntry({
 *   cache,
 *   cachePath: '/path/to/.cloudinary-cache.json',
 *   publicId: 'hospeda/accommodation/abc123',
 *   originalUrl: 'https://unsplash.com/photo',
 *   cloudinaryUrl: 'https://res.cloudinary.com/...',
 * });
 * ```
 */
export function updateCacheEntry(params: UpdateCacheEntryParams): void {
    const { cache, cachePath, publicId, originalUrl, cloudinaryUrl, fileModifiedAt } = params;

    (cache as Record<string, CacheEntry>)[publicId] = {
        originalUrl,
        cloudinaryUrl,
        uploadedAt: new Date().toISOString(),
        fileModifiedAt: fileModifiedAt ?? null
    };

    writeCache(cachePath, cache);
}
