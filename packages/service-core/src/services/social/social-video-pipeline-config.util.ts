import { SocialPublishFormatEnum } from '@repo/schemas';

/**
 * Pure Cloudinary-shaped video/story preset constants and a format-aware
 * resolver, consumed by the video pipeline for STORY and VIDEO_POST targets
 * (HOS-65 T-017).
 *
 * No DB/IO — these are hard-coded, platform-safe defaults. A future
 * iteration may make `VIDEO_POST_LIMITS` admin-tunable via `social_settings`
 * (mirroring the fallback-resolution pattern in
 * `social-image-pipeline-config.util.ts`), but that is explicitly out of
 * scope here (YAGNI) until a concrete need for per-deployment overrides
 * appears.
 */

/**
 * Cloudinary transform preset enforcing a 9:16 vertical aspect ratio with a
 * fill crop, for STORY targets (Instagram/Facebook Stories).
 *
 * Shaped to be directly assignable to `UploadOptions.transformation`
 * (`packages/media/src/server/types.ts`, HOS-65 T-016) — it is a plain
 * transform object matching the Cloudinary SDK's `ImageTransformationOptions`
 * / `VideoTransformationOptions` shape (both extend
 * `CommonTransformationOptions`, which declares `aspect_ratio`, `crop`, and
 * `gravity`).
 */
export const STORY_ASPECT_RATIO_TRANSFORM = {
    aspect_ratio: '9:16',
    crop: 'fill',
    gravity: 'auto'
} as const;

/**
 * Duration/size limits enforced for VIDEO_POST targets.
 */
export interface VideoPostLimits {
    /** Maximum allowed video duration, in seconds. */
    readonly maxDurationSeconds: number;
    /** Maximum allowed video file size, in bytes. */
    readonly maxSizeBytes: number;
}

/**
 * Platform-safe default duration/size limits for VIDEO_POST targets:
 * 60 seconds max duration, 100 MB max file size.
 *
 * Admin-tunable via `social_settings` in a future iteration — hard-coded for
 * now (YAGNI: no concrete requirement for per-deployment overrides yet).
 */
export const VIDEO_POST_LIMITS: VideoPostLimits = {
    maxDurationSeconds: 60,
    maxSizeBytes: 100 * 1024 * 1024
};

/**
 * Discriminated result of {@link resolveVideoPipelinePreset}.
 */
export type VideoPipelinePreset =
    | { readonly kind: 'story'; readonly transformation: typeof STORY_ASPECT_RATIO_TRANSFORM }
    | { readonly kind: 'video_post'; readonly limits: VideoPostLimits }
    | { readonly kind: 'none' };

/**
 * Resolves the video/story Cloudinary preset for a given publish format.
 *
 * Pure function — no DB/IO. Only `STORY` and `VIDEO_POST` have a defined
 * preset today; every other {@link SocialPublishFormatEnum} value resolves to
 * `{ kind: 'none' }`.
 *
 * @param publishFormat - The target's publish format.
 * @returns The matching preset, discriminated by `kind`.
 *
 * @example
 * ```ts
 * const preset = resolveVideoPipelinePreset(SocialPublishFormatEnum.STORY);
 * if (preset.kind === 'story') {
 *   // preset.transformation is directly usable as UploadOptions.transformation
 * }
 * ```
 */
export function resolveVideoPipelinePreset(
    publishFormat: SocialPublishFormatEnum
): VideoPipelinePreset {
    if (publishFormat === SocialPublishFormatEnum.STORY) {
        return { kind: 'story', transformation: STORY_ASPECT_RATIO_TRANSFORM };
    }
    if (publishFormat === SocialPublishFormatEnum.VIDEO_POST) {
        return { kind: 'video_post', limits: VIDEO_POST_LIMITS };
    }
    return { kind: 'none' };
}
