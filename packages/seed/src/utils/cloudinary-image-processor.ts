import type { ImageProvider } from '@repo/media/server';
import { ModerationStatusEnum } from '@repo/schemas';
import type { ImageCache } from './cloudinary-cache.js';
import { type UploadSeedImageOutcome, uploadSeedImage } from './cloudinary-upload.js';
import { logger } from './logger.js';
import type { ImageProcessingCounters, SeedSource } from './seedContext.js';

/**
 * Folder segment used by the avatar seed pipeline. Per SPEC-078 REQ-02,
 * avatar assets live under `hospeda/{env}/seed/avatars/{userId}.{ext}` rather
 * than the default `{entityType}/{entityId}/{role}` layout.
 */
const AVATAR_ENTITY_TYPE = 'avatars' as const;

/**
 * Folder segment used for post sponsor logos. SPEC-078-GAPS GAP-078-077
 * requires `hospeda/{env}/seed/postSponsor/{entityId}/logo` regardless of
 * how the seed factory pluralises/cases the calling `entityType`.
 */
const POST_SPONSOR_ENTITY_TYPE = 'postSponsor' as const;

/**
 * Folder segment used for event organizer logos. SPEC-078-GAPS GAP-078-077
 * requires `hospeda/{env}/seed/eventOrganizer/{entityId}/logo` regardless of
 * how the seed factory pluralises/cases the calling `entityType`.
 */
const EVENT_ORGANIZER_ENTITY_TYPE = 'eventOrganizer' as const;

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
    /** Environment label used in the Cloudinary folder path, e.g. 'dev'. */
    readonly env: string;
    /**
     * Discriminates between required and example seed tracks. For `example`,
     * the processor skips Cloudinary entirely and keeps the raw URL plus the
     * attribution block (photographer/sourceUrl/license) intact.
     */
    readonly seedSource: SeedSource;
    /**
     * When `seedSource === 'required'` and this flag is `true`, fetch/upload
     * failures fall back to the original URL and are counted as failures but
     * do not abort the seed. When `false` (default), required failures throw.
     */
    readonly allowRequiredFallback?: boolean;
    /**
     * Mutable counters instance updated in-place by this function. Optional
     * because callers outside the seed factory may not care about telemetry.
     */
    readonly counters?: ImageProcessingCounters;
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
 *
 * `videos` is included as a pass-through field per SPEC-078-GAPS GAP-078-083.
 * The processor does not upload videos (their URLs are external in this
 * pipeline); the property exists only to keep TypeScript happy when fixtures
 * carry a `media.videos` array.
 */
interface MediaBlock {
    featuredImage?: MediaImageEntry;
    gallery?: MediaImageEntry[];
    videos?: unknown[];
    [key: string]: unknown;
}

/**
 * Internal shape for the object form of a sponsor `logo` block.
 * Per SPEC-078-GAPS GAP-078-077, post sponsor fixtures store `logo` as
 * `{ url, caption?, description?, moderationState?, ... }`.
 */
interface LogoBlock {
    url?: string;
    [key: string]: unknown;
}

/**
 * Internal helper: runs an upload job for a required-track image, applying the
 * `allowRequiredFallback` semantics and updating counters.
 *
 * @throws When `allowRequiredFallback` is false and the upload fails.
 */
async function runRequiredUpload(args: {
    readonly originalUrl: string;
    readonly entityType: string;
    readonly entityId: string;
    readonly role: string;
    readonly provider: ImageProvider;
    readonly cache: ImageCache;
    readonly cachePath: string;
    readonly env: string;
    readonly allowFallback: boolean;
    readonly counters?: ImageProcessingCounters;
    /**
     * Optional explicit public ID. When provided, the standard
     * `hospeda/{env}/seed/{entityType}/{entityId}/{role}` construction is
     * bypassed (used by the avatar pipeline per REQ-02).
     */
    readonly publicIdOverride?: string;
}): Promise<string> {
    const {
        originalUrl,
        entityType,
        entityId,
        role,
        provider,
        cache,
        cachePath,
        env,
        allowFallback,
        counters,
        publicIdOverride
    } = args;

    const outcome = await uploadSeedImage({
        originalUrl,
        entityType,
        entityId,
        role,
        provider,
        cache,
        cachePath,
        env,
        throwOnFailure: !allowFallback,
        publicIdOverride
    });

    if (counters) {
        if (outcome.status === 'uploaded') counters.uploaded += 1;
        else if (outcome.status === 'cached') counters.cached += 1;
        else counters.failures += 1;
    }

    if (outcome.status === 'failed' && allowFallback) {
        logger.warn(
            `[seed:images] required fallback engaged for ${entityType}/${entityId}/${role}: ${outcome.errorMessage ?? 'unknown error'}`
        );
    }

    return outcome.cloudinaryUrl;
}

/**
 * Processes all image URLs within an entity's data.
 *
 * For `required` seed source with a configured provider, replaces URLs with
 * Cloudinary URLs (using cache to dedupe). For `example` seed source, early
 * returns `data` unchanged to preserve the raw source URL and attribution
 * metadata (`photographer`, `sourceUrl`, `license`) added in SPEC-078-GAPS T-010.
 *
 * Handles three image locations:
 * - `data.media.featuredImage.url`  → role `'featured'`
 * - `data.media.gallery[n].url`     → role `'gallery/0'`, `'gallery/1'`, …
 * - `data.profile.avatar`           → role `'avatar'` (user entities)
 *
 * If `provider` is `null` (no Cloudinary configured), the function returns
 * `data` unchanged so the seed process works normally.
 *
 * @param params - See {@link ProcessEntityImagesParams}.
 * @returns A shallow copy of `data` with image URLs replaced by Cloudinary URLs
 *          (required track), or the original `data` (example/no-provider).
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
 *   env: 'dev',
 *   seedSource: 'required',
 * });
 * ```
 */
export async function processEntityImages(
    params: ProcessEntityImagesParams
): Promise<Record<string, unknown>> {
    const {
        data,
        entityType,
        entityId,
        provider,
        cache,
        cachePath,
        env,
        seedSource,
        allowRequiredFallback = false,
        counters
    } = params;

    // --- Early return: example source skips Cloudinary entirely ---
    if (seedSource === 'example') {
        if (counters) {
            const examplePendingJobs = countImageJobs(data);
            counters.skippedExample += examplePendingJobs;
        }
        return data;
    }

    // --- Early return: no provider configured → keep originals ---
    if (!provider) {
        return data;
    }

    const result: Record<string, unknown> = { ...data };

    // --- media.featuredImage ---
    const media = data.media as MediaBlock | undefined;
    if (media) {
        const updatedMedia: MediaBlock = { ...media };

        if (media.featuredImage?.url) {
            const cloudinaryUrl = await runRequiredUpload({
                originalUrl: media.featuredImage.url,
                entityType,
                entityId,
                role: 'featured',
                provider,
                cache,
                cachePath,
                env,
                allowFallback: allowRequiredFallback,
                counters
            });
            updatedMedia.featuredImage = withModerationDefault({
                ...media.featuredImage,
                url: cloudinaryUrl
            });
        }

        // --- media.gallery ---
        if (Array.isArray(media.gallery) && media.gallery.length > 0) {
            const updatedGallery = await Promise.all(
                media.gallery.map(async (entry, index) => {
                    if (!entry.url) return withModerationDefault(entry);
                    const cloudinaryUrl = await runRequiredUpload({
                        originalUrl: entry.url,
                        entityType,
                        entityId,
                        role: `gallery/${index}`,
                        provider,
                        cache,
                        cachePath,
                        env,
                        allowFallback: allowRequiredFallback,
                        counters
                    });
                    return withModerationDefault({ ...entry, url: cloudinaryUrl });
                })
            );
            updatedMedia.gallery = updatedGallery;
        }

        result.media = updatedMedia;
    }

    // --- profile.avatar (user entities) ---
    // Per SPEC-078 REQ-02, avatars live at `hospeda/{env}/seed/avatars/{userId}`
    // (flat path, no `role` suffix). The processor overrides the default
    // `{entityType}/{entityId}/{role}` layout for this branch only.
    const profile = data.profile as Record<string, unknown> | undefined;
    if (profile?.avatar && typeof profile.avatar === 'string') {
        const avatarPublicId = `hospeda/${env}/seed/${AVATAR_ENTITY_TYPE}/${entityId}`;
        const cloudinaryUrl = await runRequiredUpload({
            originalUrl: profile.avatar,
            entityType: AVATAR_ENTITY_TYPE,
            entityId,
            role: 'avatar',
            provider,
            cache,
            cachePath,
            env,
            allowFallback: allowRequiredFallback,
            counters,
            publicIdOverride: avatarPublicId
        });
        result.profile = { ...profile, avatar: cloudinaryUrl };
    }

    // --- logo (postSponsor + eventOrganizer) ---
    // Per SPEC-078-GAPS GAP-078-077, sponsor + organizer logos live at
    // `hospeda/{env}/seed/{postSponsor|eventOrganizer}/{entityId}/logo`.
    // The seed factory passes `entityType` as the lowercased `entityName`
    // (e.g. 'postsponsors', 'eventorganizers'), so we override the public
    // ID to enforce the camelCase, singular folder segment expected by the
    // spec. Detection rules:
    //   - postSponsor: `data.logo` is an object `{ url, ... }`. The whole
    //     object is preserved with the URL replaced by the Cloudinary URL.
    //   - eventOrganizer: `data.logo` is a raw string URL. The string is
    //     replaced with the Cloudinary URL.
    const lowerEntityType = entityType.toLowerCase();
    const isPostSponsor = lowerEntityType.startsWith('postsponsor');
    const isEventOrganizer = lowerEntityType.startsWith('eventorganizer');

    if (isPostSponsor && data.logo && typeof data.logo === 'object') {
        const logo = data.logo as LogoBlock;
        if (typeof logo.url === 'string' && logo.url.length > 0) {
            const logoPublicId = `hospeda/${env}/seed/${POST_SPONSOR_ENTITY_TYPE}/${entityId}/logo`;
            const cloudinaryUrl = await runRequiredUpload({
                originalUrl: logo.url,
                entityType: POST_SPONSOR_ENTITY_TYPE,
                entityId,
                role: 'logo',
                provider,
                cache,
                cachePath,
                env,
                allowFallback: allowRequiredFallback,
                counters,
                publicIdOverride: logoPublicId
            });
            result.logo = { ...logo, url: cloudinaryUrl };
        }
    } else if (isEventOrganizer && typeof data.logo === 'string' && data.logo.length > 0) {
        const logoPublicId = `hospeda/${env}/seed/${EVENT_ORGANIZER_ENTITY_TYPE}/${entityId}/logo`;
        const cloudinaryUrl = await runRequiredUpload({
            originalUrl: data.logo,
            entityType: EVENT_ORGANIZER_ENTITY_TYPE,
            entityId,
            role: 'logo',
            provider,
            cache,
            cachePath,
            env,
            allowFallback: allowRequiredFallback,
            counters,
            publicIdOverride: logoPublicId
        });
        result.logo = cloudinaryUrl;
    }

    return result;
}

/**
 * Injects a default `moderationState: 'APPROVED'` on a media image entry when
 * the input does not specify one (SPEC-078-GAPS GAP-078-063). Existing values
 * are preserved verbatim — the helper does NOT overwrite an explicit state.
 *
 * @internal
 */
function withModerationDefault(entry: MediaImageEntry): MediaImageEntry {
    if (entry.moderationState === undefined || entry.moderationState === null) {
        return { ...entry, moderationState: ModerationStatusEnum.APPROVED };
    }
    return entry;
}

/**
 * Counts the number of image jobs that would be processed for a given entity
 * payload. Used to increment the `skippedExample` counter when short-circuiting
 * the `example` path without actually iterating uploads.
 *
 * @internal
 */
function countImageJobs(data: Record<string, unknown>): number {
    let count = 0;
    const media = data.media as MediaBlock | undefined;
    if (media?.featuredImage?.url) count += 1;
    if (Array.isArray(media?.gallery)) {
        for (const entry of media.gallery) {
            if (entry?.url) count += 1;
        }
    }
    const profile = data.profile as Record<string, unknown> | undefined;
    if (typeof profile?.avatar === 'string' && profile.avatar) count += 1;
    // Sponsor logo (object) + organizer logo (string) — SPEC-078-GAPS GAP-078-077.
    if (data.logo) {
        if (typeof data.logo === 'string' && data.logo.length > 0) count += 1;
        else if (
            typeof data.logo === 'object' &&
            typeof (data.logo as LogoBlock).url === 'string' &&
            ((data.logo as LogoBlock).url as string).length > 0
        ) {
            count += 1;
        }
    }
    return count;
}

// Re-export internal type for upstream callers if needed.
export type { UploadSeedImageOutcome };
