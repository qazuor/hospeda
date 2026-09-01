import type { ImageProvider } from '@repo/media/server';
import { type ImageCache, isCacheHit, updateCacheEntry } from './cloudinary-cache.js';
import { describeError, toError } from './errorSerialization.js';
import { ALLOWED_SEED_HOSTNAMES, isAllowedSeedUrl } from './is-allowed-seed-url.js';
import { logger } from './logger.js';

/**
 * Per-attempt upload timeout handed to the provider, in milliseconds.
 *
 * The Cloudinary SDK's own default is a single long wait with no retry, so one
 * slow upload in a pipeline of hundreds of images stalls and then kills the
 * whole run. A shorter bounded attempt plus {@link SEED_UPLOAD_MAX_ATTEMPTS}
 * recovers from a transient stall faster than one long hang ever could.
 */
export const SEED_UPLOAD_TIMEOUT_MS = 45_000;

/** Total upload attempts per image, including the first one. */
export const SEED_UPLOAD_MAX_ATTEMPTS = 3;

/** Base delay for the exponential backoff between upload attempts, in milliseconds. */
export const SEED_UPLOAD_RETRY_BASE_DELAY_MS = 1_000;

/**
 * Appended to every fatal image-failure message on the required track.
 *
 * The flag exists and works, but nothing in the output used to mention it, so
 * an operator hitting a transient upload failure had no way to discover that
 * the seed can be completed by tolerating it.
 */
export const REQUIRED_FALLBACK_HINT =
    'Re-run the seed with --allow-required-fallback to keep the original URL for images that fail to upload.';

/**
 * Error names and system error codes that describe a transient network
 * condition rather than a rejected request. Cloudinary rejects a timed-out
 * upload with a plain object carrying `name: 'TimeoutError'` and
 * `http_code: 499`, which is neither an `Error` nor an HTTP status.
 */
const RETRYABLE_ERROR_TOKENS: readonly string[] = [
    'TimeoutError',
    'ETIMEDOUT',
    'ESOCKETTIMEDOUT',
    'ECONNRESET',
    'ECONNABORTED',
    'EAI_AGAIN'
];

/**
 * Reads an own property of a thrown value without asserting its shape.
 *
 * The value observed in a `catch` is `unknown`, and the Cloudinary SDK rejects
 * with a plain object, so the fields have to be probed rather than cast.
 */
function readErrorField(value: unknown, key: string): unknown {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }
    return (value as Record<string, unknown>)[key];
}

/**
 * Decides whether a failed upload is worth another attempt.
 *
 * Retries a timeout, a connection reset, and any 5xx (plus Cloudinary's
 * non-standard `499` timeout code). Everything else — a rejected file, an
 * invalid folder, bad credentials — fails the same way on every attempt, so it
 * is surfaced immediately.
 *
 * @param error - The value caught from the provider's `upload` call.
 * @returns `true` when the failure looks transient.
 */
function isRetryableUploadFailure(error: unknown): boolean {
    const httpCode = readErrorField(error, 'http_code');
    if (typeof httpCode === 'number' && (httpCode === 499 || httpCode >= 500)) {
        return true;
    }

    const name = readErrorField(error, 'name');
    const code = readErrorField(error, 'code');

    return RETRYABLE_ERROR_TOKENS.some(
        (token) =>
            (typeof name === 'string' && name === token) ||
            (typeof code === 'string' && code === token)
    );
}

/** Resolves after `ms` milliseconds. */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Uploads a buffer, retrying transient failures with exponential backoff.
 *
 * Retrying is safe here even though {@link ImageProvider.upload} warns that
 * uploads are not provably idempotent: every seed upload targets a
 * deterministic public ID and the provider overwrites by default, so a repeat
 * attempt replaces the same asset instead of creating a second one.
 *
 * @throws The last observed failure, once the attempts are exhausted or the
 * failure is not transient.
 */
async function uploadWithRetry(args: {
    readonly provider: ImageProvider;
    readonly file: Buffer;
    readonly folder: string;
    readonly publicId: string;
    readonly fullPublicId: string;
}): Promise<Awaited<ReturnType<ImageProvider['upload']>>> {
    const { provider, file, folder, publicId, fullPublicId } = args;
    let lastError: unknown;

    for (let attempt = 1; attempt <= SEED_UPLOAD_MAX_ATTEMPTS; attempt += 1) {
        try {
            return await provider.upload({
                file,
                folder,
                publicId,
                timeoutMs: SEED_UPLOAD_TIMEOUT_MS
            });
        } catch (error) {
            lastError = error;

            if (attempt === SEED_UPLOAD_MAX_ATTEMPTS || !isRetryableUploadFailure(error)) {
                throw error;
            }

            const backoffMs = SEED_UPLOAD_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
            logger.warn(
                `[seed:images] Upload attempt ${attempt}/${SEED_UPLOAD_MAX_ATTEMPTS} failed for ${fullPublicId}: ${describeError(error).message} — retrying in ${backoffMs}ms`
            );
            await delay(backoffMs);
        }
    }

    // Unreachable: the loop always returns or throws.
    throw toError(lastError);
}

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
 *   originalUrl: 'https://images.pexels.com/photos/271639/pexels-photo-271639.jpeg',
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

    // GAP-078-030: SSRF allowlist — only fetch from well-known image CDNs.
    // On violation we log + skip; we never throw (even with throwOnFailure),
    // because a disallowed URL is a fixture/data issue, not a network error.
    if (!isAllowedSeedUrl(originalUrl)) {
        const message = `Rejected seed image fetch: URL hostname not in allowlist (${ALLOWED_SEED_HOSTNAMES.join(', ')})`;
        logger.warn(
            `[seed:images] ${message} — url=${originalUrl} — skipping upload, using original URL`
        );
        return { status: 'failed', cloudinaryUrl: originalUrl, errorMessage: message };
    }

    try {
        // Fetch the original image
        const response = await fetch(originalUrl);
        if (!response.ok) {
            const message = `Failed to fetch image (${response.status}): ${originalUrl}`;
            if (throwOnFailure) {
                // Thrown from inside the try, so the catch below reports it —
                // including the `--allow-required-fallback` hint. Do not log here.
                throw new Error(message);
            }
            logger.warn(`[seed:images] ${message} — using original URL`);
            return { status: 'failed', cloudinaryUrl: originalUrl, errorMessage: message };
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        // Upload to Cloudinary, tolerating a transient stall (HOS-397).
        const uploadResult = await uploadWithRetry({
            provider,
            file: buffer,
            folder,
            publicId: publicIdSegment,
            fullPublicId
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
        // `String(error)` used to collapse Cloudinary's plain rejection object
        // into the useless `[object Object]`, discarding `http_code` and `name`
        // (HOS-397). `describeError` serializes the whole value instead.
        const { message } = describeError(error);
        if (throwOnFailure) {
            logger.error(
                `[seed:images] Upload failed for ${fullPublicId}: ${message}. ${REQUIRED_FALLBACK_HINT}`
            );
            throw toError(error);
        }
        logger.warn(
            `[seed:images] Upload failed for ${fullPublicId}: ${message} — using original URL`
        );
        return { status: 'failed', cloudinaryUrl: originalUrl, errorMessage: message };
    }
}
