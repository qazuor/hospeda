/**
 * Shared media upload helpers for admin and protected tiers.
 *
 * Extracts common upload logic (file validation, Cloudinary upload,
 * response validation) so both tiers reuse the same code without
 * duplicating the Cloudinary interaction pattern.
 */

import type { ImageProvider } from '@repo/media/server';
import { resolveEnvironment, validateMediaFile } from '@repo/media/server';
import { UploadResponseDataSchema } from '@repo/schemas';
import { Sentry } from '../../lib/sentry';
import { incrementDomainCounter } from '../../middlewares/metrics';
import { apiLogger } from '../../utils/logger';

/** Maximum file size in megabytes for entity uploads. */
const ENTITY_MAX_FILE_SIZE_MB = 5;

/** Margin above the strict file-size limit for Content-Length pre-check. */
const CONTENT_LENGTH_MARGIN = 1024;

/**
 * Single-attempt upstream timeout (ms) for the interactive entity-upload
 * path (BETA-134).
 *
 * The web owner editor uploads photos via a synchronous XHR request. Without
 * a bound on this end, a slow/hanging Cloudinary response eventually gets
 * killed by the reverse proxy in front of the API, which returns its OWN
 * non-JSON error body — breaking the client's `JSON.parse(xhr.responseText)`
 * before our own (already JSON-safe) error handling ever gets a chance to
 * respond. Bounding this call well under any realistic reverse-proxy timeout
 * lets this code win the race and produce a clean typed JSON error first.
 *
 * MUST stay below the reverse-proxy timeout so we win the race and return
 * JSON; pending calibration during staging smoke.
 *
 * Deliberately single-attempt: no retry (see {@link uploadToProvider} JSDoc
 * for the rationale — retrying is NOT safe here). Also NOT mirroring the
 * 180s batch-importer timeout in `scripts/process-destination-photos.ts`,
 * which runs offline with no synchronous caller waiting on a live HTTP
 * connection.
 */
const UPLOAD_TIMEOUT_MS = 25_000;

/**
 * Result of a successful upload.
 */
export interface UploadHelperResult {
    readonly url: string;
    readonly publicId: string;
    readonly width: number;
    readonly height: number;
    readonly moderationState: 'APPROVED';
}

/**
 * Error result from the upload helper.
 */
export interface UploadHelperError {
    readonly code: string;
    readonly message: string;
    readonly status: number;
}

/**
 * Validate the Content-Length header against the max file size.
 *
 * @param contentLength - The Content-Length header value
 * @param maxMb - Maximum file size in megabytes
 * @returns null on success, error result on failure
 */
export function validateContentLength(
    contentLength: number,
    maxMb: number = ENTITY_MAX_FILE_SIZE_MB
): UploadHelperError | null {
    const maxBytes = maxMb * 1024 * 1024;
    if (contentLength > maxBytes + CONTENT_LENGTH_MARGIN) {
        return {
            code: 'PAYLOAD_TOO_LARGE',
            message: `File exceeds the ${maxMb}MB limit`,
            status: 413
        };
    }
    return null;
}

/**
 * Validate a file buffer (size, MIME type, dimensions).
 *
 * @param buffer - The file buffer
 * @param mimeType - The MIME type from the multipart form
 * @param context - The validation context ('entity' or 'avatar')
 * @param maxFileSizeMb - Maximum file size in megabytes
 * @returns null on success, error result on failure
 */
export function validateFile(
    buffer: Buffer,
    mimeType: string,
    context: 'entity' | 'avatar' = 'entity',
    maxFileSizeMb: number = ENTITY_MAX_FILE_SIZE_MB
): UploadHelperError | null {
    const validation = validateMediaFile({
        buffer,
        mimeType,
        context,
        maxFileSizeMb
    });

    if (!validation.valid) {
        return {
            code: 'UNPROCESSABLE_ENTITY',
            message: `File validation failed: ${validation.error}`,
            status: 422
        };
    }
    return null;
}

/**
 * Upload a file to Cloudinary and validate the response.
 *
 * Applies a single bounded upload timeout, with NO retry (BETA-134): the
 * interactive entity-upload path has no client-side timeout of its own, so a
 * hanging Cloudinary call must fail fast on our end rather than let an
 * upstream reverse-proxy timeout return a non-JSON error body. See
 * {@link UPLOAD_TIMEOUT_MS} for the rationale.
 *
 * Deliberately single-attempt: `packages/media/src/server/cloudinary.provider.ts`
 * documents that Cloudinary uploads are not provably idempotent at the SDK
 * level, so an automatic caller-level retry here risks leaking an orphaned
 * Cloudinary asset version when Cloudinary itself is merely slow (not
 * actually failed). The bounded timeout alone fixes the root cause — our
 * code returns a typed JSON error before the reverse proxy has a chance to
 * inject its own non-JSON body.
 *
 * @param provider - The image provider instance
 * @param params - Upload parameters
 * @returns The validated upload result or an error
 */
export async function uploadToProvider(
    provider: ImageProvider,
    params: {
        readonly buffer: Buffer;
        readonly folder: string;
        readonly publicId: string;
        readonly tags?: readonly string[];
        readonly overwrite?: boolean;
        readonly entityType: string;
        readonly entityId: string;
        /** The authenticated actor's id. Used in observability logs. */
        readonly actorId?: string;
    }
): Promise<UploadHelperResult | UploadHelperError> {
    let uploadResult: Awaited<ReturnType<typeof provider.upload>> | undefined;
    let uploadError: unknown;

    try {
        uploadResult = await provider.upload({
            file: params.buffer,
            folder: params.folder,
            publicId: params.publicId,
            timeoutMs: UPLOAD_TIMEOUT_MS,
            ...(params.tags === undefined ? {} : { tags: [...params.tags] }),
            ...(params.overwrite === undefined ? {} : { overwrite: params.overwrite })
        });
    } catch (thrownError) {
        uploadError = thrownError;
    }

    if (!uploadResult) {
        apiLogger.error(
            {
                error: uploadError instanceof Error ? uploadError.message : String(uploadError),
                entityType: params.entityType,
                entityId: params.entityId
            },
            'Cloudinary upload failed'
        );
        Sentry.captureException(uploadError, {
            tags: { component: 'media-provider', operation: 'upload' },
            contexts: { media: { entityType: params.entityType, entityId: params.entityId } }
        });
        incrementDomainCounter('media_upload_total', 'failure');
        return {
            code: 'UPSTREAM_ERROR',
            message: 'Image upload failed',
            status: 502
        };
    }

    const parsedResponse = UploadResponseDataSchema.safeParse({
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        width: uploadResult.width,
        height: uploadResult.height,
        moderationState: 'APPROVED'
    });

    if (!parsedResponse.success) {
        apiLogger.error(
            {
                issues: parsedResponse.error.issues.map((i) => ({
                    path: i.path.join('.'),
                    code: i.code
                })),
                entityType: params.entityType,
                entityId: params.entityId
            },
            'Cloudinary response did not match UploadResponseDataSchema'
        );
        incrementDomainCounter('media_upload_total', 'failure');
        return {
            code: 'UPSTREAM_ERROR',
            message: 'Incomplete response from image service',
            status: 502
        };
    }

    apiLogger.info(
        {
            event: 'media.upload.success',
            publicId: parsedResponse.data.publicId,
            preset: `${params.entityType}:entity`,
            entityType: params.entityType,
            entityId: params.entityId,
            actorId: params.actorId
        },
        'media upload success'
    );
    incrementDomainCounter('media_upload_total', 'success');

    return parsedResponse.data;
}

/**
 * Build the storage folder path for an entity upload.
 *
 * @param entityType - The entity type
 * @param entityId - The entity UUID
 * @returns The Cloudinary folder path
 */
export function buildEntityFolder(entityType: string, entityId: string): string {
    const environment = resolveEnvironment();
    return `hospeda/${environment}/${entityType}s/${entityId}`;
}

/** Fixed max file size in bytes for entity uploads. */
export const ENTITY_MAX_BYTES = ENTITY_MAX_FILE_SIZE_MB * 1024 * 1024;

/** Content-length margin for the pre-check. */
export const CONTENT_LENGTH_MARGIN_BYTES = CONTENT_LENGTH_MARGIN;

// ---------------------------------------------------------------------------
// buildPatchPayload
// ---------------------------------------------------------------------------

/**
 * Shape of a single media image as sent by the web editor (nested form).
 */
export interface NestedMediaImage {
    readonly id: string;
    readonly alt?: string;
}

/**
 * Nested media shape sent by the web editor when patching accommodation media.
 *
 * The web app sends `{ media: { featuredImage, gallery } }` after a successful
 * upload. `buildPatchPayload` normalises this to flat service-layer keys.
 */
export interface NestedMediaInput {
    readonly featuredImage?: NestedMediaImage | null;
    readonly gallery?: readonly NestedMediaImage[];
}

/**
 * Input accepted by `buildPatchPayload`.
 *
 * Can be either:
 * - **nested**: `{ media: { featuredImage?, gallery? }, ...otherFields }`
 * - **flat**: `{ featuredImageId?, galleryImageIds?, ...otherFields }`
 * - **mixed**: both shapes are present (nested wins for the media keys).
 *
 * All non-media keys are passed through untouched.
 */
export interface BuildPatchPayloadInput {
    readonly media?: NestedMediaInput;
    readonly featuredImageId?: string | null;
    readonly galleryImageIds?: readonly string[];
    readonly [key: string]: unknown;
}

/**
 * Result of `buildPatchPayload` after normalisation.
 *
 * Always uses flat service-layer keys. The `media` wrapper is stripped.
 */
export interface BuildPatchPayloadResult {
    readonly featuredImageId?: string | null;
    readonly galleryImageIds?: readonly string[];
    readonly [key: string]: unknown;
}

/**
 * Normalise a media patch payload from nested→flat form.
 *
 * The web editor sends `{ media: { featuredImage: { id, alt }, gallery: [] } }`
 * after a successful upload. The service layer expects flat keys
 * (`featuredImageId`, `galleryImageIds`). This function bridges the two shapes
 * so the PATCH route handler can work with either form transparently.
 *
 * **Normalisation rules:**
 * - If `input.media?.featuredImage` is a non-null object, its `.id` is promoted
 *   to `featuredImageId` on the output.
 * - If `input.media?.featuredImage` is `null`, `featuredImageId` is explicitly
 *   set to `null` so the DB row receives a NULL write (clearing the image).
 * - If `input.media?.gallery` is an array, the `.id` of each entry is collected
 *   into `galleryImageIds`.
 * - When `input.media` is absent, flat keys (`featuredImageId`,
 *   `galleryImageIds`) are forwarded unchanged, including `null` values.
 * - When neither nested nor flat media keys are present for a given field, that
 *   key is omitted from the output entirely (no accidental undefined writes).
 * - All non-media keys are forwarded as-is.
 *
 * @param input - The raw PATCH body from the route handler
 * @returns Normalised flat payload ready for the service layer
 *
 * @example
 * ```ts
 * // Nested form (from web editor after upload)
 * buildPatchPayload({ media: { featuredImage: { id: 'img-1', alt: 'Room' }, gallery: [] } })
 * // → { featuredImageId: 'img-1', galleryImageIds: [] }
 *
 * // Clearing the featured image
 * buildPatchPayload({ media: { featuredImage: null, gallery: [] } })
 * // → { featuredImageId: null, galleryImageIds: [] }
 *
 * // Flat form (legacy or other callers)
 * buildPatchPayload({ featuredImageId: 'img-2', galleryImageIds: ['g-1'] })
 * // → { featuredImageId: 'img-2', galleryImageIds: ['g-1'] }
 * ```
 */
export function buildPatchPayload(input: BuildPatchPayloadInput): BuildPatchPayloadResult {
    // Strip the `media` wrapper from the output; all other keys are forwarded.
    const {
        media,
        featuredImageId: flatFeaturedId,
        galleryImageIds: flatGalleryIds,
        ...rest
    } = input;

    const result: Record<string, unknown> = { ...rest };

    if (media === undefined) {
        // ── Flat form: forward as-is, including explicit null ────────────────

        // Only include featuredImageId when the caller explicitly provided it
        // (including null — null signals a deliberate clear, not an omission).
        if (Object.hasOwn(input, 'featuredImageId')) {
            result.featuredImageId = flatFeaturedId ?? null;
        }

        if (flatGalleryIds !== undefined) {
            result.galleryImageIds = flatGalleryIds;
        }
    } else {
        // ── Nested form: extract from media wrapper ──────────────────────────

        // featuredImage: object → extract id; null → explicit null for DB clear
        if (Object.hasOwn(media, 'featuredImage')) {
            result.featuredImageId = media.featuredImage == null ? null : media.featuredImage.id;
        }

        // gallery: array → extract ids
        if (media.gallery !== undefined) {
            result.galleryImageIds = media.gallery.map((img) => img.id);
        }
    }

    return result as BuildPatchPayloadResult;
}
