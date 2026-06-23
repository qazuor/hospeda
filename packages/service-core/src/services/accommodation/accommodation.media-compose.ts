/**
 * accommodation.media-compose.ts
 *
 * Pure read-composition helper that rebuilds the `Media` JSONB shape from
 * relational `accommodation_media` rows (SPEC-204, T-012).
 *
 * Phase 2 (P2) contract:
 *  - The relational `accommodation_media` table becomes the read source for
 *    `featuredImage`, `gallery`, and `archivedGallery`.
 *  - `videos` are NOT migrated to the table (D1 decision) and continue to be
 *    carried forward from the existing JSONB `media.videos`.
 *  - The output shape is byte-identical to what consumers received while reads
 *    came from JSONB, so the ~21 downstream read-sites stay untouched (T-013).
 *
 * This module is deliberately PURE (no DB access): it receives already-loaded
 * rows and the current media value, and returns the composed object. The async
 * row loading + chokepoint wiring lives in T-013. Keeping composition pure makes
 * the golden shape-stability test (T-015) trivial to write.
 *
 * Row → shape mapping (mirrors the T-006 backfill / T-007 write-both ordering):
 *  - featuredImage    ← the single row with `is_featured = true` (state 'visible').
 *  - gallery[]        ← `state = 'visible'` AND `is_featured = false`, ordered by `sort_order ASC`.
 *  - archivedGallery[] ← `state = 'archived'`, ordered by `sort_order ASC` (own sequence).
 *  - videos           ← passed through unchanged from the JSONB media value.
 *
 * @module accommodation.media-compose
 */

import type { AccommodationMedia, Image, Media, Video } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

/**
 * Inputs required by {@link composeAccommodationMedia}.
 */
export interface ComposeAccommodationMediaInput {
    /**
     * All non-deleted `accommodation_media` rows for one accommodation, in any
     * order (this helper re-sorts by `sortOrder`). May include both `visible`
     * and `archived` rows.
     */
    readonly rows: readonly AccommodationMedia[];
    /**
     * The current JSONB media value (or `null`/`undefined`). Only `videos` is
     * read from it — every image field is rebuilt from `rows`. Pass the entity's
     * existing `media` so videos survive the read switch.
     */
    readonly currentMedia?: Media | null;
}

// ---------------------------------------------------------------------------
// Private mapping helpers
// ---------------------------------------------------------------------------

/**
 * Projects a relational `accommodation_media` row onto the public {@link Image}
 * shape, dropping every relational-only column (`id`, `accommodationId`,
 * `state`, `isFeatured`, `sortOrder`, `archivedAt`, timestamps, `deletedAt`).
 *
 * Optional columns are nullable in Postgres (`string | null`) whereas
 * `ImageSchema` uses optional (`string | undefined`). Rather than emit explicit
 * `{ caption: undefined }` keys, an absent/null value is OMITTED entirely so the
 * composed object is byte-identical to the sparse object the JSONB read path
 * produced (guards the T-015 golden shape-stability test).
 */
function rowToImage(row: AccommodationMedia): Image {
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
function bySortOrder(a: AccommodationMedia, b: AccommodationMedia): number {
    return a.sortOrder - b.sortOrder;
}

// ---------------------------------------------------------------------------
// Public composition function
// ---------------------------------------------------------------------------

/**
 * Composes the `Media` shape from relational `accommodation_media` rows plus the
 * videos carried forward from the JSONB media value.
 *
 * Output rules (each field is omitted when empty, matching how the JSONB read
 * path produced a sparse object):
 *  - `featuredImage`   — present only when a `is_featured` visible row exists.
 *  - `gallery`         — present only when ≥1 visible non-featured row exists.
 *  - `archivedGallery` — present only when ≥1 archived row exists.
 *  - `videos`          — present only when the incoming media had videos.
 *
 * The result is a fresh object; neither `rows` nor `currentMedia` is mutated.
 *
 * @param input - {@link ComposeAccommodationMediaInput}
 * @returns The composed {@link Media} object (possibly empty `{}`).
 */
export function composeAccommodationMedia({
    rows,
    currentMedia
}: ComposeAccommodationMediaInput): Media {
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

    // Videos are not migrated to the table — carry them forward from JSONB.
    const videos: readonly Video[] | undefined = currentMedia?.videos;
    if (videos && videos.length > 0) {
        media.videos = [...videos];
    }

    return media;
}
