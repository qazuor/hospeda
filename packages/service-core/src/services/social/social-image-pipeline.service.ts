import type {
    SocialAssetModel,
    SocialPostMediaModel,
    SocialPostTargetMediaModel,
    SocialSettingModel
} from '@repo/db';
import {
    SocialAssetModel as RealSocialAssetModel,
    SocialPostMediaModel as RealSocialPostMediaModel,
    SocialPostTargetMediaModel as RealSocialPostTargetMediaModel,
    SocialSettingModel as RealSocialSettingModel
} from '@repo/db';
import type { ImageProvider, UploadOptions } from '@repo/media/server';
import { SocialAssetSourceEnum, SocialMediaTypeEnum } from '@repo/schemas';
import type { SocialPublishFormatEnum } from '@repo/schemas';
import type { ServiceConfig } from '../../types';
import { isUuid } from '../../utils/identifier';
import { serviceLogger } from '../../utils/service-logger';
import type { ServiceLogger } from '../../utils/service-logger';
import {
    DOWNLOAD_TIMEOUT_MS_FALLBACK,
    DOWNLOAD_TIMEOUT_MS_KEY,
    SOCIAL_ASSETS_FOLDER_FALLBACK,
    SOCIAL_ASSETS_FOLDER_KEY,
    resolveNumericSettingWithFallback,
    resolveStringSettingWithFallback
} from './social-image-pipeline-config.util';
import { resolveVideoPipelinePreset } from './social-video-pipeline-config.util';

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

/**
 * Flat GPT video payload type — mirrors the `GptVideoPayloadSchema` in
 * `@repo/schemas/social-draft.http.schema` (HOS-65 T-007).
 *
 * Unlike {@link GptImagePayload}, `mode` has a single variant (`'public_url'`):
 * video files are too large for OpenAI's `openai_file_refs` injection path, so
 * phase 1 requires a direct HTTPS URL. `mode` stays a single-variant literal
 * (not a bare string) so a future mode can be added without a breaking change.
 */
export interface GptVideoPayload {
    /** Mode discriminant — currently only `'public_url'` is supported. */
    readonly mode: 'public_url';
    /** Direct HTTPS URL of the video to download and re-upload to Cloudinary. */
    readonly url?: string;
    /** Optional MIME type hint (e.g., "video/mp4"). */
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
    /**
     * ID of the `social_post_targets` row this asset should be scoped to
     * (HOS-65 G-3 per-target/per-format publishing). When provided (and
     * `socialPostId` is also provided, so a `social_post_media` row was
     * actually created), a `social_post_target_media` link row is created
     * pointing at the newly created media row. When `undefined`, no link row
     * is created — this keeps pre-HOS-65 G-3 callers backward compatible.
     */
    readonly socialPostTargetId?: string;
    /**
     * The target's publish format (HOS-65 T-021). When it resolves to a
     * `STORY` preset via {@link resolveVideoPipelinePreset}, the 9:16
     * Cloudinary transform is applied to the upload. `undefined` (pre-HOS-65
     * T-021 callers) applies no transformation — fully backward compatible.
     */
    readonly publishFormat?: SocialPublishFormatEnum;
    /**
     * Post-global base offset for the `social_post_media.position` column
     * (HOS-65 per-target collision fix). `social_post_media` has a
     * `UNIQUE(social_post_id, position)` index, so when a post fans out to
     * multiple targets that EACH carry media, every target's inserts must
     * occupy a DISTINCT position slice of the post. The caller
     * (`SocialDraftIngestionService`) threads a running count of media rows
     * already created for the post as this offset; the pipeline adds the
     * per-asset index on top. The `social_post_target_media` link row keeps a
     * PER-TARGET position (0..N-1 within the target) so per-target ordering is
     * unaffected. Defaults to `0` (single-target / standalone callers).
     */
    readonly mediaPositionOffset?: number;
}

/**
 * Input for {@link SocialImagePipelineService.processVideo} (HOS-65 T-013).
 */
export interface ProcessVideoInput {
    /** GPT video payload (`public_url` mode only in phase 1). */
    readonly video: GptVideoPayload;
    /**
     * ID of the `social_posts` row to link the asset to via `social_post_media`.
     * When `undefined` no `social_post_media` row is created.
     */
    readonly socialPostId?: string;
    /**
     * ID of the `social_post_targets` row this asset should be scoped to
     * (HOS-65 G-3). Same semantics as {@link ProcessImageInput.socialPostTargetId}.
     */
    readonly socialPostTargetId?: string;
    /**
     * ID of the acting user / system actor. Stored in `social_assets.created_by_id`.
     */
    readonly actorId?: string;
    /**
     * The target's publish format (HOS-65 T-021). When it resolves to a
     * `VIDEO_POST` preset via {@link resolveVideoPipelinePreset}, the
     * resolved duration/size limits are enforced as pre-persist validation
     * (see {@link SocialImagePipelineService.processVideo} for the exact
     * rejection points). `undefined` applies no limit — fully backward compatible.
     */
    readonly publishFormat?: SocialPublishFormatEnum;
    /**
     * Post-global base offset for the `social_post_media.position` column.
     * See {@link ProcessImageInput.mediaPositionOffset}. A standalone video is
     * always its own single asset, so the pipeline adds `0` on top of this
     * offset. Defaults to `0`.
     */
    readonly mediaPositionOffset?: number;
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

/** Warning message returned when media download or upload fails. */
const MEDIA_FAILURE_WARNING = 'Media upload failed; manual upload required';

/**
 * Warning returned when the Cloudinary upload + `social_assets` insert succeeded
 * but persisting the `social_post_media` / `social_post_target_media` link row
 * failed (HOS-65). This is surfaced (not silently swallowed) so the failure
 * cannot masquerade as a green `assetStatus` while the media is missing from
 * the post/target — which previously caused a silent fall-back to post-level
 * media and cross-target media leaks.
 */
const MEDIA_LINK_FAILURE_WARNING =
    'Media uploaded but could not be linked to the post/target; manual review required';

/**
 * Builds the rejection warning for a video whose downloaded byte size exceeds
 * the resolved VIDEO_POST limit (HOS-65 T-021). Checked BEFORE the Cloudinary
 * upload call — cheap, since the bytes are already in memory from the download
 * step, and avoids uploading an asset that will be rejected anyway.
 */
function buildVideoSizeLimitWarning(maxSizeBytes: number): string {
    return `Video exceeds the maximum allowed size of ${maxSizeBytes} bytes for VIDEO_POST; manual upload required`;
}

/**
 * Builds the rejection warning for a video whose Cloudinary-reported duration
 * exceeds the resolved VIDEO_POST limit (HOS-65 T-021). Checked AFTER the
 * Cloudinary upload call — duration is only known once Cloudinary has
 * processed the file, so the asset is already stored there when this check
 * runs; the `social_assets` row is simply never created (same orphaned-asset
 * precedent as an `assetModel.create` failure elsewhere in this class).
 */
function buildVideoDurationLimitWarning(maxDurationSeconds: number): string {
    return `Video exceeds the maximum allowed duration of ${maxDurationSeconds}s for VIDEO_POST; manual upload required`;
}

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
 * 3. Download the image bytes with `fetch()` and a configurable `AbortController`
 *    timeout (default 15 s, `download_timeout_ms` social setting — HOS-64 G-2).
 * 4. Upload the bytes to Cloudinary via the injected `ImageProvider`.
 * 5. Persist a `social_assets` row with the Cloudinary fields + metadata.
 * 6. Optionally create a `social_post_media` link row at `position = 0`, and
 *    (HOS-65 G-3) optionally a `social_post_target_media` link row scoping
 *    that media row to a specific `social_post_targets` row.
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
    private readonly settingModel: SocialSettingModel;
    private readonly postTargetMediaModel: SocialPostTargetMediaModel;
    private readonly mediaProvider: ImageProvider;
    private readonly logger: ServiceLogger;

    constructor(
        _config: ServiceConfig,
        mediaProvider: ImageProvider,
        assetModel?: SocialAssetModel,
        postMediaModel?: SocialPostMediaModel,
        settingModel?: SocialSettingModel,
        postTargetMediaModel?: SocialPostTargetMediaModel
    ) {
        this.mediaProvider = mediaProvider;
        this.assetModel = assetModel ?? new RealSocialAssetModel();
        this.postMediaModel = postMediaModel ?? new RealSocialPostMediaModel();
        this.settingModel = settingModel ?? new RealSocialSettingModel();
        this.postTargetMediaModel = postTargetMediaModel ?? new RealSocialPostTargetMediaModel();
        this.logger = serviceLogger;
    }

    // ---------------------------------------------------------------------------
    // Settings-driven config (HOS-64 G-2)
    // ---------------------------------------------------------------------------

    /**
     * Reads `download_timeout_ms` from `social_settings`, falling back to
     * 15000 when the row is missing or its value is not a finite number.
     */
    private async getDownloadTimeoutMs(): Promise<number> {
        const settingRow = await this.settingModel.findOne({ key: DOWNLOAD_TIMEOUT_MS_KEY });
        return resolveNumericSettingWithFallback({
            rawValue: settingRow?.value as string | null | undefined,
            fallback: DOWNLOAD_TIMEOUT_MS_FALLBACK
        });
    }

    /**
     * Reads `social_assets_folder` from `social_settings`, falling back to
     * `hospeda/social/assets` when the row is missing or empty.
     */
    private async getAssetsFolder(): Promise<string> {
        const settingRow = await this.settingModel.findOne({ key: SOCIAL_ASSETS_FOLDER_KEY });
        return resolveStringSettingWithFallback({
            rawValue: settingRow?.value as string | null | undefined,
            fallback: SOCIAL_ASSETS_FOLDER_FALLBACK
        });
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
        return this.processSingleImage(input, 0);
    }

    /**
     * Downloads and persists N image assets sequentially, assigning each one a
     * 0-indexed `position` matching its index in `inputs` (HOS-65 G-3 carousel
     * support).
     *
     * Each asset is processed independently via {@link processSingleImage} with
     * the same graceful-failure contract as {@link processImage}: one asset
     * failing does NOT abort its siblings, and a failed asset never produces an
     * orphaned `social_post_media` or `social_post_target_media` row — both link
     * rows are only created after a successful upload + `social_assets` insert
     * for that specific asset.
     *
     * Assets are processed sequentially (not in parallel) so `position` values
     * stay deterministic and DB writes for the same post do not race on the
     * composite `(social_post_id, position)` unique index.
     *
     * @param inputs - One `ProcessImageInput` per asset, in the desired display order.
     * @returns One {@link ProcessImageResult} per input, in the same order.
     *
     * @example
     * ```ts
     * const results = await pipeline.processImages([
     *   { image: imageA, socialPostId, socialPostTargetId },
     *   { image: imageB, socialPostId, socialPostTargetId },
     * ]);
     * // results[0] -> position 0, results[1] -> position 1
     * ```
     */
    public async processImages(inputs: ProcessImageInput[]): Promise<ProcessImageResult[]> {
        const results: ProcessImageResult[] = [];
        for (let position = 0; position < inputs.length; position++) {
            const input = inputs[position];
            if (!input) continue;
            const result = await this.processSingleImage(input, position);
            results.push(result);
        }
        return results;
    }

    /**
     * Downloads the image from the GPT payload and re-uploads it to Cloudinary,
     * then persists a `social_assets` row and (optionally) `social_post_media` /
     * `social_post_target_media` link rows at the given `position`.
     *
     * Shared implementation behind {@link processImage} (always `position = 0`)
     * and {@link processImages} (sequential `position` per input index).
     *
     * @param input - Image payload, optional post/target IDs to link, optional actor ID.
     * @param position - 0-indexed display/carousel position for this asset.
     * @returns Result with `assetId`, `cloudinaryUrl` (nullable), and `warnings`.
     */
    private async processSingleImage(
        input: ProcessImageInput,
        position: number
    ): Promise<ProcessImageResult> {
        const { image, socialPostId, actorId, socialPostTargetId, publishFormat } = input;
        const mediaPositionOffset = input.mediaPositionOffset ?? 0;

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

        // Step 3: Upload to Cloudinary. STORY targets get the 9:16 aspect-ratio
        // transform preset (HOS-65 T-021); every other format uploads untouched.
        const preset = publishFormat ? resolveVideoPipelinePreset(publishFormat) : null;
        const transformation = preset?.kind === 'story' ? preset.transformation : undefined;

        const uploadResult = await this.uploadToCloudinary(
            downloadResult.buffer,
            mimeType,
            transformation
        );
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
                // `social_assets.created_by_id` is a uuid FK to `users`. Synthetic
                // actors (e.g. the GPT API-key actor `gpt-action`) are NOT real
                // user rows and are not valid UUIDs, so persist NULL for them
                // rather than letting the insert fail on an invalid-uuid cast.
                createdById: actorId && isUuid(actorId) ? actorId : undefined
            });
            assetId = asset.id;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn({ error: message }, 'Failed to persist social_assets row');
            return this.gracefulFail();
        }

        // Step 6: Optionally link to the social post (+ target, HOS-65 G-3).
        // `social_post_media.position` is POST-GLOBAL (offset + per-asset index)
        // so multiple targets never collide on UNIQUE(social_post_id, position);
        // the `social_post_target_media` link row keeps the PER-TARGET position.
        if (assetId) {
            const linkResult = await this.createMediaLinks({
                assetId,
                mediaPosition: mediaPositionOffset + position,
                targetPosition: position,
                socialPostId,
                socialPostTargetId
            });
            if (!linkResult.ok) {
                return this.gracefulFail(linkResult.warning);
            }
        }

        return { assetId, cloudinaryUrl: url, warnings: [] };
    }

    /**
     * Downloads the video from the GPT payload and re-uploads it to Cloudinary,
     * then persists a `social_assets` row (with `mediaType` forced to `VIDEO`
     * and `durationSeconds` set from the upload result) and optionally
     * `social_post_media` / `social_post_target_media` link rows.
     *
     * Reuses the same download (fetch + `AbortController` timeout) and
     * `uploadToCloudinary` steps as {@link processSingleImage}, and the same
     * graceful-failure contract: on any error after argument parsing it
     * returns `cloudinaryUrl: null` + a warning string instead of throwing,
     * and never creates an orphaned link row.
     *
     * Video only supports `mode: 'public_url'` in phase 1 (HOS-65 T-013) — no
     * `openai_file_refs` extraction is needed.
     *
     * When `publishFormat` resolves to the `VIDEO_POST` preset (HOS-65 T-021,
     * see {@link resolveVideoPipelinePreset}), its duration/size limits are
     * enforced as graceful-failure VALIDATION (not a Cloudinary transform —
     * there is no non-destructive way to "cap" a video via a transform param):
     * an oversized download is rejected BEFORE the Cloudinary upload call; an
     * over-duration video (only knowable from Cloudinary's own response) is
     * rejected AFTER upload, by simply never persisting the `social_assets` row.
     *
     * @param input - Video payload, optional post/target IDs to link, optional actor ID.
     * @returns Result with `assetId`, `cloudinaryUrl` (nullable), and `warnings`.
     *
     * @example
     * ```ts
     * const result = await pipeline.processVideo({
     *   video: { mode: 'public_url', url: 'https://example.com/clip.mp4' },
     *   socialPostId: 'post-uuid',
     *   socialPostTargetId: 'target-uuid',
     * });
     * ```
     */
    public async processVideo(input: ProcessVideoInput): Promise<ProcessImageResult> {
        const { video, socialPostId, socialPostTargetId, actorId, publishFormat } = input;
        const mediaPositionOffset = input.mediaPositionOffset ?? 0;

        const downloadUrl = video.url ?? '';
        const mimeType = video.mimeType ?? null;
        const altText = video.altText ?? null;

        // Resolve the VIDEO_POST preset (HOS-65 T-021). This preset is DURATION/
        // SIZE LIMITS, not a Cloudinary transform — there is no meaningful
        // Cloudinary transform for "cap this video's duration/size" that doesn't
        // silently mutate (e.g. truncate) the uploaded content, which the pipeline
        // must not do without the caller asking for it. Limits are therefore
        // enforced as pre/post-upload VALIDATION using the existing
        // graceful-failure contract, at the earliest point each value is known:
        // size is known immediately after download (checked BEFORE uploading,
        // to avoid uploading an asset that will be rejected anyway); duration is
        // only reported by Cloudinary AFTER upload completes (checked before the
        // `social_assets` row is persisted).
        const preset = publishFormat ? resolveVideoPipelinePreset(publishFormat) : null;
        const videoLimits = preset?.kind === 'video_post' ? preset.limits : null;
        // STORY targets get the 9:16 aspect-ratio transform, mirroring the
        // image path (HOS-65 T-021) — a STORY video must be cropped to 9:16
        // exactly like a STORY image, not uploaded untouched.
        const transformation = preset?.kind === 'story' ? preset.transformation : undefined;

        // Step 1: Download the video bytes with a timeout.
        const downloadResult = await this.downloadImage(downloadUrl);
        if (!downloadResult.success) {
            this.logger.warn(
                { url: downloadUrl, error: downloadResult.error },
                'Video download failed'
            );
            return this.gracefulFail();
        }

        if (videoLimits && downloadResult.buffer.byteLength > videoLimits.maxSizeBytes) {
            this.logger.warn(
                {
                    sizeBytes: downloadResult.buffer.byteLength,
                    maxSizeBytes: videoLimits.maxSizeBytes
                },
                'Video exceeds VIDEO_POST max size limit; upload skipped'
            );
            return this.gracefulFail(buildVideoSizeLimitWarning(videoLimits.maxSizeBytes));
        }

        // Step 2: Upload to Cloudinary. Force `resource_type: 'video'` so
        // Cloudinary processes the file as a video and reports `duration`
        // (HOS-65), and apply the STORY 9:16 transform when applicable.
        const uploadResult = await this.uploadToCloudinary(
            downloadResult.buffer,
            mimeType,
            transformation,
            'video'
        );
        if (!uploadResult.success) {
            this.logger.warn({ error: uploadResult.error }, 'Cloudinary upload failed');
            return this.gracefulFail();
        }

        const { url, publicId, width, height, durationSeconds } = uploadResult.data;

        if (
            videoLimits &&
            durationSeconds !== undefined &&
            durationSeconds > videoLimits.maxDurationSeconds
        ) {
            this.logger.warn(
                { durationSeconds, maxDurationSeconds: videoLimits.maxDurationSeconds },
                'Video exceeds VIDEO_POST max duration limit; social_assets row not persisted'
            );
            return this.gracefulFail(
                buildVideoDurationLimitWarning(videoLimits.maxDurationSeconds)
            );
        }

        // Step 3: Persist the social_assets row. mediaType is always VIDEO here
        // (unlike processSingleImage, which infers it from a MIME hint) and
        // durationSeconds is persisted from the upload result.
        let assetId: string | null = null;
        try {
            const asset = await this.assetModel.create({
                source: SocialAssetSourceEnum.EXTERNAL_URL,
                cloudinaryUrl: url,
                cloudinaryPublicId: publicId,
                originalUrl: downloadUrl,
                openaiFileRef: undefined,
                mimeType: mimeType ?? undefined,
                mediaType: SocialMediaTypeEnum.VIDEO,
                width: width ?? undefined,
                height: height ?? undefined,
                durationSeconds: durationSeconds ?? undefined,
                altText: altText ?? undefined,
                createdById: actorId && isUuid(actorId) ? actorId : undefined
            });
            assetId = asset.id;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn({ error: message }, 'Failed to persist social_assets row');
            return this.gracefulFail();
        }

        // Step 4: Optionally link to the social post (+ target, HOS-65 G-3).
        // A standalone video is always its own single asset, so the per-target
        // position is 0; the post-global media position is the caller-provided
        // offset (post-global collision fix).
        if (assetId) {
            const linkResult = await this.createMediaLinks({
                assetId,
                mediaPosition: mediaPositionOffset,
                targetPosition: 0,
                socialPostId,
                socialPostTargetId
            });
            if (!linkResult.ok) {
                return this.gracefulFail(linkResult.warning);
            }
        }

        return { assetId, cloudinaryUrl: url, warnings: [] };
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    /**
     * Creates the `social_post_media` link row (and, in turn, the
     * `social_post_target_media` link row when `socialPostTargetId` is given)
     * for an already-persisted `social_assets` row.
     *
     * A failure of EITHER insert is now SURFACED (HOS-65): it is logged at
     * `error` level and returned as `{ ok: false, warning }` so the caller can
     * degrade the result to a graceful failure rather than reporting a green
     * `assetStatus` with no backing media row. Previously these failures were
     * silently swallowed, which let a `UNIQUE(social_post_id, position)`
     * collision (from per-target position reuse) drop the media row and link
     * row unnoticed — the dispatch then leaked one target's media to another.
     *
     * No-ops entirely (returns `{ ok: true }`) when `socialPostId` is absent —
     * this keeps standalone/re-upload callers (no post to link to yet) working.
     *
     * @param params - The persisted asset ID, the POST-GLOBAL `mediaPosition`
     *   for the `social_post_media` row, the PER-TARGET `targetPosition` for
     *   the `social_post_target_media` link row, and the optional post/target
     *   IDs to link.
     * @returns `{ ok: true }` on success (or when nothing to link), or
     *   `{ ok: false, warning }` when an insert failed.
     */
    private async createMediaLinks(params: {
        readonly assetId: string;
        readonly mediaPosition: number;
        readonly targetPosition: number;
        readonly socialPostId?: string;
        readonly socialPostTargetId?: string;
    }): Promise<{ readonly ok: boolean; readonly warning?: string }> {
        const { assetId, mediaPosition, targetPosition, socialPostId, socialPostTargetId } = params;

        if (!socialPostId) {
            return { ok: true };
        }

        let postMediaId: string;
        try {
            const postMedia = await this.postMediaModel.create({
                socialPostId,
                assetId,
                position: mediaPosition
            });
            postMediaId = postMedia.id;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(
                { error: message, assetId, socialPostId, position: mediaPosition },
                'Failed to create social_post_media link'
            );
            return { ok: false, warning: MEDIA_LINK_FAILURE_WARNING };
        }

        // Optionally link the newly created media row to a specific target
        // (HOS-65 G-3 per-target/per-format publishing).
        if (socialPostTargetId) {
            try {
                await this.postTargetMediaModel.create({
                    socialPostTargetId,
                    socialPostMediaId: postMediaId,
                    position: targetPosition
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                this.logger.error(
                    {
                        error: message,
                        assetId,
                        socialPostMediaId: postMediaId,
                        socialPostTargetId
                    },
                    'Failed to create social_post_target_media link'
                );
                return { ok: false, warning: MEDIA_LINK_FAILURE_WARNING };
            }
        }

        return { ok: true };
    }

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
     * Downloads image bytes from the given URL with a timeout.
     *
     * Timeout defaults to 15 s, configurable via `download_timeout_ms`
     * (HOS-64 G-2) — see {@link getDownloadTimeoutMs}.
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

        const downloadTimeoutMs = await this.getDownloadTimeoutMs();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), downloadTimeoutMs);

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
     * @param transformation - Optional Cloudinary transform preset forwarded
     *   to `UploadOptions.transformation` (HOS-65 T-016/T-021 — e.g. the
     *   STORY 9:16 crop). `undefined` applies no transformation.
     * @param resourceType - Optional Cloudinary `resource_type` forwarded to
     *   `UploadOptions.resourceType`. Defaults to `'image'` at the provider
     *   level when omitted; video callers pass `'video'` so Cloudinary
     *   processes the file as a video and reports `duration` (HOS-65).
     * @returns Upload result or failure.
     */
    private async uploadToCloudinary(
        buffer: Buffer,
        _mimeType: string | null,
        transformation?: UploadOptions['transformation'],
        resourceType?: UploadOptions['resourceType']
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
            const assetsFolder = await this.getAssetsFolder();
            const result = await this.mediaProvider.upload({
                file: buffer,
                folder: assetsFolder,
                tags: ['social', 'gpt-ingestion'],
                transformation,
                resourceType
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
     *
     * @param message - Warning message to surface. Defaults to the generic
     *   {@link MEDIA_FAILURE_WARNING}; callers with a more specific reason
     *   (e.g. a VIDEO_POST duration/size limit violation, HOS-65 T-021) pass
     *   their own message instead.
     */
    private gracefulFail(message: string = MEDIA_FAILURE_WARNING): ProcessImageResult {
        return { assetId: null, cloudinaryUrl: null, warnings: [message] };
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
