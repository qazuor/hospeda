import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
    CLOUDINARY_CACHE_VERSION,
    cloudinaryCacheFileSchema
} from '../schemas/cloudinary-cache.schema.js';
import { logger } from './logger.js';

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
 *
 * This is the in-memory representation. On disk the cache is wrapped in a
 * versioned envelope — see
 * `packages/seed/src/schemas/cloudinary-cache.schema.ts`.
 */
export type ImageCache = Record<string, CacheEntry>;

/**
 * Re-export of the current cache file schema version for callers that want
 * to detect migrations externally (e.g. tooling scripts).
 *
 * GAP-078-120 — persisted files are tagged with this integer so future
 * schema migrations can be detected.
 */
export { CLOUDINARY_CACHE_VERSION } from '../schemas/cloudinary-cache.schema.js';

/**
 * Reads the image cache from disk and validates it with Zod
 * (GAP-078-120). Returns an empty cache if the file is missing, corrupt,
 * has an unsupported version, or fails schema validation.
 *
 * Validation failures are logged as warnings and the invalid file is
 * deleted — we never throw — because seeding should continue with a fresh
 * cache rather than aborting the run.
 *
 * @param cachePath - Absolute path to the cache JSON file
 * @returns Parsed cache object, or empty object on missing/corrupt/invalid file
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

        const validation = cloudinaryCacheFileSchema.safeParse(parsed);
        if (!validation.success) {
            logger.warn(
                `[seed] Cache file failed schema validation — starting fresh (${validation.error.issues.length} issue(s))`
            );
            tryDeleteCache(cachePath);
            return {};
        }

        return { ...validation.data.entries };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return {};
        }
        logger.warn('[seed] Cache file corrupted, starting fresh');
        tryDeleteCache(cachePath);
        return {};
    }
}

/**
 * Internal wrapper that ignores ENOENT and swallows secondary errors during
 * cleanup after a corrupt/invalid cache is detected.
 */
function tryDeleteCache(cachePath: string): void {
    try {
        deleteCache(cachePath);
    } catch {
        // ignore secondary errors during cleanup
    }
}

/**
 * Writes the cache to disk atomically (write to a temp file, then rename).
 * This prevents corruption if the process is killed mid-write.
 *
 * The on-disk format is the versioned envelope defined by
 * `cloudinaryCacheFileSchema`. The in-memory `ImageCache` is wrapped here on
 * the way out.
 *
 * @param cachePath - Absolute path to the destination cache JSON file
 * @param cache - In-memory cache object to persist
 *
 * @example
 * ```ts
 * writeCache('/path/to/.cloudinary-cache.json', { 'my/public-id': { ... } });
 * ```
 */
export function writeCache(cachePath: string, cache: ImageCache): void {
    const dir = dirname(cachePath);
    const tmpFile = join(dir, `.cloudinary-cache-${Date.now()}.tmp`);
    const envelope = {
        version: CLOUDINARY_CACHE_VERSION,
        entries: cache
    };
    writeFileSync(tmpFile, JSON.stringify(envelope, null, 2), 'utf-8');
    renameSync(tmpFile, cachePath);
}

/**
 * Persists the in-memory cache to disk exactly once, typically at the end
 * of a seed run (GAP-078-033 — deferred flush).
 *
 * Thin alias for {@link writeCache} to make call sites read naturally:
 * ```ts
 * await runRequiredSeeds(ctx);
 * flushCache(path, ctx.imageCache);
 * ```
 *
 * Splitting the name from `writeCache` documents caller intent: `flushCache`
 * is the end-of-run persistence point, while `writeCache` is the low-level
 * atomic write used internally.
 *
 * @param cachePath - Absolute path to the destination cache JSON file
 * @param cache - In-memory cache object to persist
 */
export function flushCache(cachePath: string, cache: ImageCache): void {
    writeCache(cachePath, cache);
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
    /**
     * Absolute path to the cache JSON file. Ignored since GAP-078-033 —
     * persistence is now deferred to a single {@link flushCache} call at the
     * end of the run. The field is kept in the input shape so existing
     * call sites compile without modification; it may be removed in a
     * future cleanup pass.
     *
     * @deprecated Cache writes no longer happen per-entry. Omit this field.
     */
    readonly cachePath?: string;
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
 * Updates a single entry in the in-memory cache object (GAP-078-033).
 *
 * The update is now **memory-only**: callers must invoke {@link flushCache}
 * exactly once at the end of the run to persist the accumulated entries to
 * disk. This avoids N atomic writes when uploads happen concurrently
 * (`Promise.all`) and ensures the disk file reflects a consistent snapshot
 * of a completed (or aborted) batch.
 *
 * @param params - See {@link UpdateCacheEntryParams}
 *
 * @example
 * ```ts
 * updateCacheEntry({
 *   cache,
 *   publicId: 'hospeda/accommodation/abc123',
 *   originalUrl: 'https://unsplash.com/photo',
 *   cloudinaryUrl: 'https://res.cloudinary.com/...',
 * });
 * // ...later, once at the end of the run:
 * flushCache(cachePath, cache);
 * ```
 */
export function updateCacheEntry(params: UpdateCacheEntryParams): void {
    const { cache, publicId, originalUrl, cloudinaryUrl, fileModifiedAt } = params;

    (cache as Record<string, CacheEntry>)[publicId] = {
        originalUrl,
        cloudinaryUrl,
        uploadedAt: new Date().toISOString(),
        fileModifiedAt: fileModifiedAt ?? null
    };
}

/** Per-URL HEAD timeout for {@link validateCacheEntries} (milliseconds). */
const VALIDATE_CACHE_HEAD_TIMEOUT_MS = 5_000;

/** Input parameters for {@link validateCacheEntries}. */
export interface ValidateCacheEntriesParams {
    /** In-memory cache object to validate (mutated in-place). */
    readonly cache: ImageCache;
    /**
     * Optional override for the HEAD fetch implementation. Defaults to the
     * global `fetch`. Exposed for tests that need to stub network calls
     * without touching `globalThis`.
     */
    readonly fetchImpl?: typeof fetch;
    /** Timeout per HEAD request in milliseconds. Defaults to 5000. */
    readonly timeoutMs?: number;
}

/** Result of {@link validateCacheEntries}. */
export interface ValidateCacheEntriesResult {
    /** Number of entries checked. */
    readonly checked: number;
    /** Number of entries removed because the URL was unreachable or non-200. */
    readonly removed: number;
    /** Number of entries that passed the HEAD check. */
    readonly kept: number;
}

/**
 * Runs a HEAD request against each cached `cloudinaryUrl` and removes any
 * entry that responds with non-200 or errors out (GAP-078-079). The input
 * `cache` object is mutated in-place; callers still have to call
 * {@link flushCache} to persist the cleaned cache to disk.
 *
 * Concurrency: sequential. This is a maintenance flag, so the extra wall
 * time is acceptable and it avoids adding `p-limit` as a dependency.
 *
 * Timeout: 5 seconds per URL (configurable via {@link ValidateCacheEntriesParams.timeoutMs}).
 * Network errors and timeouts are treated exactly like a non-200 response.
 *
 * @param params - See {@link ValidateCacheEntriesParams}.
 * @returns Summary counts. See {@link ValidateCacheEntriesResult}.
 */
export async function validateCacheEntries(
    params: ValidateCacheEntriesParams
): Promise<ValidateCacheEntriesResult> {
    const { cache, fetchImpl = fetch, timeoutMs = VALIDATE_CACHE_HEAD_TIMEOUT_MS } = params;

    let removed = 0;
    let kept = 0;
    const keys = Object.keys(cache);

    for (const key of keys) {
        const entry = cache[key];
        if (!entry) continue;

        const url = entry.cloudinaryUrl;
        const isStale = await isEntryStale({ url, fetchImpl, timeoutMs });

        if (isStale) {
            delete cache[key];
            removed += 1;
            logger.warn(`[seed:validate-cache] Removed stale entry ${key} — url=${url}`);
        } else {
            kept += 1;
        }
    }

    return { checked: keys.length, removed, kept };
}

/**
 * Internal helper — returns `true` if the URL does not respond 2xx within
 * {@link VALIDATE_CACHE_HEAD_TIMEOUT_MS}. Network errors and timeouts count
 * as stale.
 */
async function isEntryStale(params: {
    readonly url: string;
    readonly fetchImpl: typeof fetch;
    readonly timeoutMs: number;
}): Promise<boolean> {
    const { url, fetchImpl, timeoutMs } = params;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetchImpl(url, { method: 'HEAD', signal: controller.signal });
        return !response.ok;
    } catch {
        return true;
    } finally {
        clearTimeout(timeout);
    }
}
