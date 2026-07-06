import { SocialMediaTypeEnum, SocialPublishFormatEnum } from '@repo/schemas';

/**
 * A resolved media row, joining a `social_post_media` (or per-target media
 * link) row with its `social_assets` record.
 *
 * This is the minimal shape {@link resolveTargetMediaUrls} needs — callers
 * (e.g. `SocialPublishDispatchService.buildMakePayload`) assemble it from two
 * separate DB reads (the media join row for `position`, the asset row for the
 * Cloudinary URL and `mediaType`) before calling this pure function.
 */
export interface MediaRow {
    /** Cloudinary delivery URL (`social_assets.cloudinary_url`). */
    readonly url: string;
    /** 0-indexed display/carousel order (`social_post_media.position`). */
    readonly position: number;
    /** Asset media kind (`social_assets.media_type`) — distinguishes video rows for VIDEO_POST. */
    readonly mediaType: SocialMediaTypeEnum;
}

/**
 * Input for {@link resolveTargetMediaUrls}.
 */
export interface ResolveTargetMediaUrlsInput {
    /** The target's publish format — drives the format-aware selection rule. */
    readonly publishFormat: string;
    /** Media rows scoped to this specific target (per-target assets, HOS-65 G-3). */
    readonly targetMediaRows: MediaRow[];
    /**
     * Post-level media rows (legacy, pre-HOS-65 G-3), used as a fallback ONLY
     * when `targetMediaRows` is empty.
     */
    readonly postMediaRowsFallback: MediaRow[];
}

/**
 * Sorts media rows by `position` ascending. Does not mutate the input array.
 */
function sortByPosition(rows: MediaRow[]): MediaRow[] {
    return [...rows].sort((a, b) => a.position - b.position);
}

/**
 * Publish formats that resolve to a SINGLE asset (the first one, by
 * `position` order) — mirrors {@link SocialPublishFormatEnum.STORY}.
 * `IMAGE_POST`'s own doc comment is explicit: "a single image" (HOS-65 T-019).
 */
const SINGLE_ASSET_FORMATS: readonly string[] = [
    SocialPublishFormatEnum.STORY,
    SocialPublishFormatEnum.IMAGE_POST
];

/**
 * Publish formats that resolve to a SINGLE video asset (the first `VIDEO`-type
 * row, by `position` order) — mirrors {@link SocialPublishFormatEnum.VIDEO_POST}.
 * `REEL`'s own doc comment is explicit: "short-form vertical video" (HOS-65 T-019).
 */
const SINGLE_VIDEO_FORMATS: readonly string[] = [
    SocialPublishFormatEnum.VIDEO_POST,
    SocialPublishFormatEnum.REEL
];

/**
 * Publish formats that resolve to ALL assets, ordered by `position` — mirrors
 * {@link SocialPublishFormatEnum.CAROUSEL}. `FEED_POST`/`PHOTO_POST` are
 * generic feed posts with no single-vs-multi distinction of their own, so they
 * inherit the "return everything" rule that predates per-format awareness
 * (HOS-65 T-019) rather than silently dropping media for the majority of real
 * seeded platform-formats (Instagram FEED_POST, Facebook PHOTO_POST).
 */
const ALL_ASSETS_FORMATS: readonly string[] = [
    SocialPublishFormatEnum.CAROUSEL,
    SocialPublishFormatEnum.FEED_POST,
    SocialPublishFormatEnum.PHOTO_POST
];

/**
 * Applies the format-aware media-selection rule to an already-ordered set of
 * rows for one format, returning the resolved Cloudinary URLs.
 *
 * Every {@link SocialPublishFormatEnum} value has an explicit rule here — see
 * {@link SINGLE_ASSET_FORMATS}, {@link SINGLE_VIDEO_FORMATS}, and
 * {@link ALL_ASSETS_FORMATS} for the groupings beyond the 4 originally
 * distinguished formats (STORY/VIDEO_POST/CAROUSEL/TEXT_POST).
 */
function selectUrlsForFormat(publishFormat: string, rows: MediaRow[]): string[] {
    if (publishFormat === SocialPublishFormatEnum.TEXT_POST) {
        return [];
    }

    const ordered = sortByPosition(rows);

    if (SINGLE_ASSET_FORMATS.includes(publishFormat)) {
        const first = ordered[0];
        return first ? [first.url] : [];
    }

    if (SINGLE_VIDEO_FORMATS.includes(publishFormat)) {
        const firstVideo = ordered.find((row) => row.mediaType === SocialMediaTypeEnum.VIDEO);
        return firstVideo ? [firstVideo.url] : [];
    }

    if (ALL_ASSETS_FORMATS.includes(publishFormat)) {
        return ordered.map((row) => row.url);
    }

    // No remaining SocialPublishFormatEnum value reaches here in practice —
    // kept as a defensive fallback for an unrecognized/future format string.
    return [];
}

/**
 * Resolves the ordered Cloudinary media URLs for a single publish target,
 * applying a format-aware selection rule (HOS-65 G-3).
 *
 * Pure function — performs no DB access or I/O. Callers resolve
 * `targetMediaRows` and `postMediaRowsFallback` beforehand.
 *
 * Selection rule (operates on `targetMediaRows`; when that array is EMPTY the
 * exact same rule is re-applied to `postMediaRowsFallback` instead):
 * - `TEXT_POST` — always `[]`, even when rows exist.
 * - `STORY`, `IMAGE_POST` — the first asset only (by `position` order), max 1 URL.
 * - `VIDEO_POST`, `REEL` — the first `VIDEO`-type asset only (by `position` order), max 1 URL.
 * - `CAROUSEL`, `FEED_POST`, `PHOTO_POST` — all assets, ordered by `position`.
 *
 * Every {@link SocialPublishFormatEnum} value maps to one of the groups above
 * (HOS-65 T-019) — see {@link SINGLE_ASSET_FORMATS}, {@link SINGLE_VIDEO_FORMATS},
 * and {@link ALL_ASSETS_FORMATS} for the grouping rationale.
 *
 * @param input - The target's publish format, its own media rows, and the
 *   post-level fallback rows.
 * @returns The resolved, ordered array of Cloudinary URLs for this target.
 *
 * @example
 * ```ts
 * resolveTargetMediaUrls({
 *   publishFormat: SocialPublishFormatEnum.CAROUSEL,
 *   targetMediaRows: [rowB, rowA], // rowA.position < rowB.position
 *   postMediaRowsFallback: []
 * });
 * // => [rowA.url, rowB.url]
 * ```
 */
export function resolveTargetMediaUrls(input: ResolveTargetMediaUrlsInput): string[] {
    const { publishFormat, targetMediaRows, postMediaRowsFallback } = input;

    if (publishFormat === SocialPublishFormatEnum.TEXT_POST) {
        return [];
    }

    const rows = targetMediaRows.length > 0 ? targetMediaRows : postMediaRowsFallback;

    return selectUrlsForFormat(publishFormat, rows);
}
