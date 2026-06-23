import type { SocialAssetModel, SocialPostMediaModel } from '@repo/db';
import {
    SocialAssetModel as RealSocialAssetModel,
    SocialPostMediaModel as RealSocialPostMediaModel
} from '@repo/db';
import type { ImageProvider } from '@repo/media/server';
import { SocialAssetSourceEnum, SocialMediaTypeEnum } from '@repo/schemas';
import type { ServiceConfig } from '../../types';
import { serviceLogger } from '../../utils/service-logger';
import type { ServiceLogger } from '../../utils/service-logger';

// ---------------------------------------------------------------------------
// Image payload types
// ---------------------------------------------------------------------------

/**
 * An OpenAI file reference object injected at runtime by OpenAI into GPT Actions.
 *
 * OpenAI declares this field as an array of strings in the OpenAPI schema
 * (per their convention), but at RUNTIME injects an array of objects shaped
 * like this. The `download_link` is an HTTPS URL pointing to
 * `files.oaiusercontent.com` that can be used to download the file.
 *
 * @see https://platform.openai.com/docs/actions/sending-files
 */
export interface OpenAiFileIdRef {
    /** HTTPS download URL injected by OpenAI (e.g., files.oaiusercontent.com/...). */
    readonly download_link: string;
    /** OpenAI file ID (e.g., "file-abc123"). Stored in `social_assets.openai_file_ref`. */
    readonly id?: string;
    /** Original file name as reported by OpenAI. */
    readonly name?: string;
    /** MIME type as reported by OpenAI (e.g., "image/png"). */
    readonly mime_type?: string;
}

/**
 * Flat GPT image payload type — mirrors the `GptImagePayloadSchema` in
 * `@repo/schemas/social-draft.http.schema`.
 *
 * Declared as a SINGLE flat object (not a discriminated union) so that
 * `openaiFileIdRefs` is a direct top-level property. This matches the flat
 * Zod schema that replaced the `z.discriminatedUnion` to ensure OpenAI
 * Custom GPT Actions auto-inject the file refs correctly.
 *
 * Usage:
 * - When `mode === 'public_url'`: read `url` for the download URL.
 * - When `mode === 'openai_file_refs'`: read `openaiFileIdRefs[0].download_link`
 *   and `openaiFileIdRefs[0].id`. Only the first entry is processed (phase 1).
 *
 * In both modes the backend downloads the bytes and re-uploads to Cloudinary.
 */
export interface GptImagePayload {
    /** Mode discriminant: `'public_url'` or `'openai_file_refs'`. */
    readonly mode: 'public_url' | 'openai_file_refs';
    /**
     * Used when `mode === 'public_url'`.
     * Direct HTTPS URL of the image.
     */
    readonly url?: string;
    /**
     * Used when `mode === 'openai_file_refs'`.
     * One or more file reference objects injected by OpenAI at runtime.
     * Named EXACTLY `openaiFileIdRefs` — this triggers OpenAI's automatic
     * file reference population in Custom GPT Actions.
     * Only the first entry is processed in phase 1.
     */
    readonly openaiFileIdRefs?: readonly OpenAiFileIdRef[];
    /** Optional MIME type hint (e.g., "image/jpeg"). */
    readonly mimeType?: string;
    /** Optional alt text for accessibility. */
    readonly altText?: string;
}

// ---------------------------------------------------------------------------
// Input / output
// ---------------------------------------------------------------------------

/**
 * Input for {@link SocialImagePipelineService.processImage}.
 */
export interface ProcessImageInput {
    /** GPT image payload (discriminated union on `mode`). */
    readonly image: GptImagePayload;
    /**
     * ID of the `social_posts` row to link the asset to via `social_post_media`.
     * When `undefined` no `social_post_media` row is created (useful when the
     * post does not exist yet or when an asset is re-uploaded standalone).
     */
    readonly socialPostId?: string;
    /**
     * ID of the acting user / system actor. Stored in `social_assets.created_by_id`.
     */
    readonly actorId?: string;
}

/**
 * Output of {@link SocialImagePipelineService.processImage}.
 *
 * The method NEVER throws on download/upload failures — failures are surfaced as
 * `cloudinaryUrl: null` with a human-readable entry in `warnings`.
 */
export interface ProcessImageResult {
    /**
     * UUID of the `social_assets` row that was created.
     * `null` when the download failed AND the implementation could not persist
     * even a placeholder asset row.
     */
    readonly assetId: string | null;
    /**
     * Cloudinary delivery URL of the uploaded asset.
     * `null` when the download or Cloudinary upload failed.
     */
    readonly cloudinaryUrl: string | null;
    /**
     * Human-readable warnings to surface to the caller.
     * Non-empty when something went wrong but the draft can still proceed.
     */
    readonly warnings: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Download timeout in milliseconds (15 s, resolved decision #2). */
const DOWNLOAD_TIMEOUT_MS = 15_000;

/** Cloudinary folder for social media assets. Must start with 'hospeda/'. */
const SOCIAL_ASSETS_FOLDER = 'hospeda/social/assets';

/** Warning message returned when media download or upload fails. */
const MEDIA_FAILURE_WARNING = 'Media upload failed; manual upload required';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Service responsible for the image pipeline in the social publishing feature.
 *
 * ## Responsibilities
 * 1. Detect the image `mode` from the GPT payload (`public_url` | `openai_file_refs`).
 * 2. Extract the download URL (direct for `public_url`;
 *    `openaiFileIdRefs[0].download_link` for `openai_file_refs`).
 * 3. Download the image bytes with `fetch()` and a 15-second `AbortController` timeout.
 * 4. Upload the bytes to Cloudinary via the injected `ImageProvider`.
 * 5. Persist a `social_assets` row with the Cloudinary fields + metadata.
 * 6. Optionally create a `social_post_media` link row at `position = 0`.
 *
 * ## Graceful failure
 * If any step from (3) onward fails (network timeout, non-2xx HTTP response,
 * Cloudinary error, DB error during asset creation), the method does NOT throw.
 * Instead it returns `{ assetId: null, cloudinaryUrl: null, warnings: [MESSAGE] }`
 * so that the calling `SocialDraftIngestionService` can still create the post.
 *
 * SPEC-254 T-027.
 */
export class SocialImagePipelineService {
    private readonly assetModel: SocialAssetModel;
    private readonly postMediaModel: SocialPostMediaModel;
    private readonly mediaProvider: ImageProvider;
    private readonly logger: ServiceLogger;

    constructor(
        _config: ServiceConfig,
        mediaProvider: ImageProvider,
        assetModel?: SocialAssetModel,
        postMediaModel?: SocialPostMediaModel
    ) {
        this.mediaProvider = mediaProvider;
        this.assetModel = assetModel ?? new RealSocialAssetModel();
        this.postMediaModel = postMediaModel ?? new RealSocialPostMediaModel();
        this.logger = serviceLogger;
    }

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    /**
     * Downloads the image from the GPT payload and re-uploads it to Cloudinary,
     * then persists a `social_assets` row and (optionally) a `social_post_media`
     * link row.
     *
     * This method is designed for **graceful failure**: on any error after
     * argument parsing it returns `cloudinaryUrl: null` + a warning string
     * instead of throwing.
     *
     * @param input - Image payload, optional post ID to link, optional actor ID.
     * @returns Result with `assetId`, `cloudinaryUrl` (nullable), and `warnings`.
     *
     * @example
     * ```ts
     * const result = await pipeline.processImage({
     *   image: { mode: 'public_url', url: 'https://example.com/img.jpg' },
     *   socialPostId: 'post-uuid',
     *   actorId: 'actor-uuid',
     * });
     * if (result.cloudinaryUrl) {
     *   // Asset successfully uploaded
     * }
     * ```
     */
    public async processImage(input: ProcessImageInput): Promise<ProcessImageResult> {
        const { image, socialPostId, actorId } = input;

        // Step 1: Extract the download URL and any metadata from the payload.
        const { downloadUrl, openaiFileRef, mimeType, altText } = this.extractPayloadFields(image);

        // Step 2: Download the image bytes with a timeout.
        const downloadResult = await this.downloadImage(downloadUrl);
        if (!downloadResult.success) {
            this.logger.warn(
                { url: downloadUrl, error: downloadResult.error },
                'Image download failed'
            );
            return this.gracefulFail();
        }

        // Step 3: Upload to Cloudinary.
        const uploadResult = await this.uploadToCloudinary(downloadResult.buffer, mimeType);
        if (!uploadResult.success) {
            this.logger.warn({ error: uploadResult.error }, 'Cloudinary upload failed');
            return this.gracefulFail();
        }

        const { url, publicId, width, height, durationSeconds } = uploadResult.data;

        // Step 4: Determine source enum and media type.
        const source =
            image.mode === 'openai_file_refs'
                ? SocialAssetSourceEnum.CHATGPT_FILE
                : SocialAssetSourceEnum.EXTERNAL_URL;

        // Infer media type from mime type hint; default to IMAGE.
        const mediaType = this.inferMediaType(mimeType);

        // Step 5: Persist the social_assets row.
        let assetId: string | null = null;
        try {
            const asset = await this.assetModel.create({
                source,
                cloudinaryUrl: url,
                cloudinaryPublicId: publicId,
                originalUrl: downloadUrl,
                openaiFileRef: openaiFileRef ?? undefined,
                mimeType: mimeType ?? undefined,
                mediaType,
                width: width ?? undefined,
                height: height ?? undefined,
                durationSeconds: durationSeconds ?? undefined,
                altText: altText ?? undefined,
                createdById: actorId ?? undefined
            });
            assetId = asset.id;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn({ error: message }, 'Failed to persist social_assets row');
            return this.gracefulFail();
        }

        // Step 6: Optionally link to the social post.
        if (socialPostId && assetId) {
            try {
                await this.postMediaModel.create({
                    socialPostId,
                    assetId,
                    position: 0
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                // Linking failure is non-fatal: the asset exists, but the link did not.
                // This is logged as a warning but does not cause the whole pipeline to fail.
                this.logger.warn(
                    { error: message, assetId, socialPostId },
                    'Failed to create social_post_media link'
                );
            }
        }

        return { assetId, cloudinaryUrl: url, warnings: [] };
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    /**
     * Extracts the download URL and relevant metadata from the GPT image payload.
     *
     * For `public_url` mode: the URL is taken from `image.url`.
     * For `openai_file_refs` mode: the URL is taken from
     * `openaiFileIdRefs[0].download_link` and the file ID from
     * `openaiFileIdRefs[0].id`.
     *
     * @param image - The discriminated-union image payload.
     * @returns Extracted download URL and optional metadata fields.
     */
    private extractPayloadFields(image: GptImagePayload): {
        readonly downloadUrl: string;
        readonly openaiFileRef: string | null;
        readonly mimeType: string | null;
        readonly altText: string | null;
    } {
        if (image.mode === 'public_url') {
            return {
                downloadUrl: image.url ?? '',
                openaiFileRef: null,
                mimeType: image.mimeType ?? null,
                altText: image.altText ?? null
            };
        }
        // openai_file_refs: use first ref — download from download_link
        const firstRef = image.openaiFileIdRefs?.[0];
        if (!firstRef) {
            // An empty or absent array is not a valid payload, but we handle it gracefully.
            return {
                downloadUrl: '',
                openaiFileRef: null,
                mimeType: image.mimeType ?? null,
                altText: image.altText ?? null
            };
        }
        return {
            downloadUrl: firstRef.download_link,
            openaiFileRef: firstRef.id ?? null,
            mimeType: image.mimeType ?? null,
            altText: image.altText ?? null
        };
    }

    /**
     * Downloads image bytes from the given URL with a 15-second timeout.
     *
     * @param url - Absolute HTTPS URL to download from.
     * @returns `{ success: true, buffer }` on success or `{ success: false, error }`.
     */
    private async downloadImage(
        url: string
    ): Promise<{ success: true; buffer: Buffer } | { success: false; error: string }> {
        if (!url) {
            return { success: false, error: 'No download URL provided' };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                return {
                    success: false,
                    error: `Non-2xx response: ${response.status} ${response.statusText}`
                };
            }

            const arrayBuffer = await response.arrayBuffer();
            return { success: true, buffer: Buffer.from(arrayBuffer) };
        } catch (err) {
            clearTimeout(timeoutId);
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, error: message };
        }
    }

    /**
     * Uploads the given buffer to Cloudinary via the injected {@link ImageProvider}.
     *
     * @param buffer - Raw image bytes.
     * @param _mimeType - Optional MIME type hint (currently unused — Cloudinary auto-detects).
     * @returns Upload result or failure.
     */
    private async uploadToCloudinary(
        buffer: Buffer,
        _mimeType: string | null
    ): Promise<
        | {
              success: true;
              data: {
                  url: string;
                  publicId: string;
                  width: number;
                  height: number;
                  durationSeconds: number | undefined;
              };
          }
        | { success: false; error: string }
    > {
        try {
            const result = await this.mediaProvider.upload({
                file: buffer,
                folder: SOCIAL_ASSETS_FOLDER,
                tags: ['social', 'gpt-ingestion']
            });
            return {
                success: true,
                data: {
                    url: result.url,
                    publicId: result.publicId,
                    width: result.width,
                    height: result.height,
                    durationSeconds: result.durationSeconds
                }
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, error: message };
        }
    }

    /**
     * Returns the graceful-failure result object.
     *
     * Called whenever a recoverable error occurs so that the upstream
     * draft ingestion service can still persist the post.
     */
    private gracefulFail(): ProcessImageResult {
        return { assetId: null, cloudinaryUrl: null, warnings: [MEDIA_FAILURE_WARNING] };
    }

    /**
     * Infers a {@link SocialMediaTypeEnum} from a MIME type string.
     *
     * Defaults to `IMAGE` when the MIME type is absent or unrecognized.
     *
     * @param mimeType - Optional MIME type string (e.g., "video/mp4").
     * @returns The corresponding `SocialMediaTypeEnum` value.
     */
    private inferMediaType(mimeType: string | null): SocialMediaTypeEnum {
        if (!mimeType) return SocialMediaTypeEnum.IMAGE;
        if (mimeType.startsWith('video/')) return SocialMediaTypeEnum.VIDEO;
        return SocialMediaTypeEnum.IMAGE;
    }
}
