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
 * Applies the format-aware media-selection rule to an already-ordered set of
 * rows for one format, returning the resolved Cloudinary URLs.
 */
function selectUrlsForFormat(publishFormat: string, rows: MediaRow[]): string[] {
    if (publishFormat === SocialPublishFormatEnum.TEXT_POST) {
        return [];
    }

    const ordered = sortByPosition(rows);

    if (publishFormat === SocialPublishFormatEnum.STORY) {
        const first = ordered[0];
        return first ? [first.url] : [];
    }

    if (publishFormat === SocialPublishFormatEnum.VIDEO_POST) {
        const firstVideo = ordered.find((row) => row.mediaType === SocialMediaTypeEnum.VIDEO);
        return firstVideo ? [firstVideo.url] : [];
    }

    if (publishFormat === SocialPublishFormatEnum.CAROUSEL) {
        return ordered.map((row) => row.url);
    }

    // Unrecognized/other formats: no format-specific narrowing rule defined
    // yet — fall back to returning nothing rather than guessing.
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
 * - `STORY` — the first asset only (by `position` order), max 1 URL.
 * - `VIDEO_POST` — the first `VIDEO`-type asset only (by `position` order), max 1 URL.
 * - `CAROUSEL` — all assets, ordered by `position`.
 * - Any other format — `[]` (no selection rule defined).
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
