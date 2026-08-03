/**
 * commerce-media-compose.ts
 *
 * Pure read-composition helper that rebuilds the `Media` shape from relational
 * commerce-listing media rows (`gastronomy_media`, `experience_media` — HOS-372).
 *
 * Shared between `GastronomyService` and `ExperienceService` — the row shape
 * (`state`, `isFeatured`, `sortOrder`, and the image fields) is identical for
 * both verticals (see `BaseCommerceMediaSchema` in `@repo/schemas`), so a single
 * composition function serves both instead of duplicating the logic per vertical.
 *
 * Row → shape mapping (mirrors `accommodation.media-compose.ts`):
 *  - featuredImage     ← the single row with `isFeatured = true` (state 'visible').
 *  - gallery[]         ← `state = 'visible'` AND `isFeatured = false`, ordered by `sortOrder ASC`.
 *  - archivedGallery[] ← `state = 'archived'`, ordered by `sortOrder ASC` (own sequence).
 *  - videos            ← passed through unchanged from the caller-supplied `videos` array.
 *
 * ## Difference from the accommodation composer
 *
 * `composeAccommodationMedia` reads `videos` from the entity's JSONB `media.videos`
 * (accommodation never migrated videos out of the JSONB blob). Commerce listings
 * moved videos to a dedicated `videos` JSONB COLUMN on `gastronomies` / `experiences`
 * (HOS-372) — a video is an external URL, not an uploaded asset, so it never needed a
 * relational row. This composer therefore takes `videos` as an explicit parameter
 * rather than reading it off a `currentMedia` object, so callers pass
 * `entity.videos` directly instead of `entity.media.videos`.
 *
 * This module is deliberately PURE (no DB access): it receives already-loaded rows
 * plus the videos array and returns the composed object. Async row loading lives in
 * the per-vertical `*.media-read.ts` modules.
 *
 * @module commerce-media-compose
 */

import type { BaseCommerceMedia, Image, Media, Video } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

/**
 * Inputs required by {@link composeCommerceMedia}.
 */
export interface ComposeCommerceMediaInput {
    /**
     * All non-deleted commerce media rows for one listing, in any order (this
     * helper re-sorts by `sortOrder`). May include both `visible` and `archived`
     * rows. Accepts any row shape structurally compatible with
     * `BaseCommerceMediaSchema` — both `GastronomyMedia` and `ExperienceMedia`
     * qualify without a cast.
     */
    readonly rows: readonly BaseCommerceMedia[];
    /**
     * The listing's `videos` column value (or `null`/`undefined`). Passed through
     * to the output unchanged — composition never inspects or reorders it.
     */
    readonly videos?: readonly Video[] | null;
}

// ---------------------------------------------------------------------------
// Private mapping helpers
// ---------------------------------------------------------------------------

/**
 * Projects a relational commerce-media row onto the public {@link Image} shape,
 * dropping every relational-only column (`id`, the parent FK, `state`,
 * `isFeatured`, `sortOrder`, `archivedAt`, timestamps, `deletedAt`).
 *
 * Optional columns are nullable in Postgres (`string | null`) whereas
 * `ImageSchema` uses optional (`string | undefined`). Rather than emit explicit
 * `{ caption: undefined }` keys, an absent/null value is OMITTED entirely so the
 * composed object stays a sparse object, matching the accommodation composer's
 * shape-stability contract.
 */
function rowToImage(row: BaseCommerceMedia): Image {
    const image: Image = {
        moderationState: row.moderationState,
        url: row.url
    };
    if (row.caption != null) image.caption = row.caption;
    if (row.description != null) image.description = row.description;
    if (row.alt != null) image.alt = row.alt;
    if (row.publicId != null) image.publicId = row.publicId;
    if (row.attribution != null) image.attribution = row.attribution;
    return image;
}

/**
 * Stable sort by `sortOrder ASC`. Rows are copied first so the caller's array
 * is never mutated. Equal `sortOrder` values keep their incoming relative order
 * (Array.prototype.sort is stable on modern engines).
 */
function bySortOrder(a: BaseCommerceMedia, b: BaseCommerceMedia): number {
    return a.sortOrder - b.sortOrder;
}

// ---------------------------------------------------------------------------
// Public composition function
// ---------------------------------------------------------------------------

/**
 * Composes the `Media` shape from relational commerce-media rows plus the
 * listing's `videos` column value.
 *
 * Output rules (each field is omitted when empty, producing a sparse object):
 *  - `featuredImage`   — present only when an `isFeatured` visible row exists.
 *  - `gallery`         — present only when ≥1 visible non-featured row exists.
 *  - `archivedGallery` — present only when ≥1 archived row exists.
 *  - `videos`          — present only when the incoming `videos` array is non-empty.
 *
 * The result is a fresh object; neither `rows` nor `videos` is mutated.
 *
 * @param input - {@link ComposeCommerceMediaInput}
 * @returns The composed {@link Media} object (possibly empty `{}`).
 *
 * @example
 * ```ts
 * const media = composeCommerceMedia({ rows: gastronomyMediaRows, videos: gastronomy.videos });
 * ```
 */
export function composeCommerceMedia({ rows, videos }: ComposeCommerceMediaInput): Media {
    const visible = rows.filter((r) => r.state === 'visible');
    const archived = rows.filter((r) => r.state === 'archived');

    const featuredRow = visible.find((r) => r.isFeatured);
    const galleryRows = visible
        .filter((r) => !r.isFeatured)
        .slice()
        .sort(bySortOrder);
    const archivedRows = archived.slice().sort(bySortOrder);

    const media: Media = {};

    if (featuredRow) {
        media.featuredImage = rowToImage(featuredRow);
    }
    if (galleryRows.length > 0) {
        media.gallery = galleryRows.map(rowToImage);
    }
    if (archivedRows.length > 0) {
        media.archivedGallery = archivedRows.map(rowToImage);
    }

    if (videos && videos.length > 0) {
        media.videos = [...videos];
    }

    return media;
}
