import type { GptImagePayloadInput, GptVideoPayloadInput } from '@repo/schemas';
import { SocialMediaTypeEnum } from '@repo/schemas';
import type { GptImagePayload } from './social-image-pipeline.service';

/**
 * A single media entry attached to a `social_post_targets` row (HOS-65 G-3
 * per-target/per-format publishing).
 *
 * Structurally identical to the inferred element type of
 * `SocialDraftTargetSchema.assets` in `@repo/schemas`
 * (`social-draft.http.schema.ts`), which is not exported as a standalone named
 * type — this local type re-uses the same field-level input types
 * (`GptImagePayloadInput`, `GptVideoPayloadInput`) so it stays in sync with
 * the schema without depending on its internal (non-exported) shape.
 */
export interface TargetAsset {
    /** Image payload for this asset entry, when present. */
    readonly image?: GptImagePayloadInput;
    /** Video payload for this asset entry, when present. */
    readonly video?: GptVideoPayloadInput;
}

/**
 * Input for {@link resolveTargetAssets}.
 */
export interface ResolveTargetAssetsInput {
    /** The publish target, carrying its own optional `assets` array. */
    readonly target: {
        readonly assets?: TargetAsset[];
    };
    /**
     * Post-level root image payload (legacy behavior, pre-HOS-65 G-3), used as
     * a fallback when the target has no `assets` of its own.
     */
    readonly legacyImage?: GptImagePayload;
    /**
     * The media type required by this target's platform × format combination
     * (`social_platform_formats.media_type`). When `NONE`, no media is needed
     * regardless of a present `legacyImage`.
     */
    readonly targetMediaType: SocialMediaTypeEnum;
}

/**
 * Resolves the effective media assets for a single publish target (HOS-65 G-3).
 *
 * Pure function — performs no DB access or I/O. Callers resolve the target and
 * the post's legacy root image beforehand and pass them in.
 *
 * Resolution order:
 * 1. If the target carries its own non-empty `assets` array, return it as-is —
 *    per-target media takes full precedence over the post-level legacy image.
 * 2. Otherwise, if the target's media type is not `NONE` and a `legacyImage` is
 *    present, wrap it as a single-item fallback (`[{ image: legacyImage }]`) so
 *    pre-HOS-65 G-3 callers that only ever set the post-level `image` field keep
 *    working unchanged.
 * 3. Otherwise (text-only target, or no media available at all), return `[]`.
 *
 * @param input - The target, the legacy post-level image, and the target's
 *   required media type.
 * @returns The resolved array of {@link TargetAsset} entries for this target.
 *
 * @example
 * ```ts
 * // Target with its own assets — used as-is.
 * resolveTargetAssets({
 *   target: { assets: [{ image: gptImage }] },
 *   targetMediaType: SocialMediaTypeEnum.IMAGE
 * });
 * // => [{ image: gptImage }]
 *
 * // No target-level assets — falls back to the legacy post-level image.
 * resolveTargetAssets({
 *   target: {},
 *   legacyImage: gptImage,
 *   targetMediaType: SocialMediaTypeEnum.IMAGE
 * });
 * // => [{ image: gptImage }]
 *
 * // Text-only target — no media needed.
 * resolveTargetAssets({
 *   target: {},
 *   legacyImage: gptImage,
 *   targetMediaType: SocialMediaTypeEnum.NONE
 * });
 * // => []
 * ```
 */
export function resolveTargetAssets(input: ResolveTargetAssetsInput): TargetAsset[] {
    const { target, legacyImage, targetMediaType } = input;

    if (target.assets && target.assets.length > 0) {
        return target.assets;
    }

    if (targetMediaType !== SocialMediaTypeEnum.NONE && legacyImage) {
        return [{ image: legacyImage }];
    }

    return [];
}
