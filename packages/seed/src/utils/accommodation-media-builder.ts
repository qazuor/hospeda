import type { AccommodationMedia } from '@repo/schemas';
import { ModerationStatusEnum } from '@repo/schemas';

/**
 * Minimal shape for a single image entry inside a fixture's `media` block.
 * Mirrors what the JSON fixtures contain for `featuredImage` and `gallery` items.
 */
export interface FixtureImageEntry {
    readonly url: string;
    readonly caption?: string;
    readonly description?: string;
    readonly alt?: string;
    readonly publicId?: string;
}

/**
 * The `media` block shape used in accommodation JSON fixtures.
 * Videos are intentionally excluded — they stay in the JSONB blob (D1 decision).
 */
export interface FixtureMediaBlock {
    readonly featuredImage?: FixtureImageEntry;
    readonly gallery?: FixtureImageEntry[];
}

/**
 * Input for {@link buildAccommodationMediaRows}.
 */
export interface BuildAccommodationMediaRowsInput {
    /** UUID of the accommodation that owns the photos. */
    readonly accommodationId: string;
    /** The `media` block from the accommodation JSON fixture. */
    readonly media: FixtureMediaBlock;
}

/**
 * Maps the `media` block from an accommodation fixture to a list of
 * `InsertAccommodationMedia` rows ready for direct DB insertion.
 *
 * Rules (SPEC-204 T-027):
 * - `featuredImage` → `is_featured = true`, `sort_order = 0`, inserted first.
 * - `gallery[]`     → `is_featured = false`, `sort_order` ascending starting at
 *                     the slot after `featuredImage` (0 when no featured, 1 when
 *                     featured occupies slot 0).
 * - All rows:
 *   - `state        = 'visible'`
 *   - `moderationState = 'APPROVED'` (seed data is curated, no moderation needed)
 *   - `archivedAt   = null` (visible rows are never archived)
 * - Images with an empty/missing URL are silently skipped.
 * - At most ONE row will have `is_featured = true` (the single-featured invariant).
 *
 * This function is a pure data transformation — it does NOT perform any I/O.
 * Extracting the logic here makes it independently unit-testable without a DB.
 *
 * @param input - `{ accommodationId, media }` from the accommodation fixture.
 * @returns An ordered array of row objects for `AccommodationMediaModel.create()`.
 *
 * @example
 * ```typescript
 * const rows = buildAccommodationMediaRows({
 *   accommodationId: 'abc-123',
 *   media: {
 *     featuredImage: { url: 'https://…/featured.jpg', caption: 'Main view' },
 *     gallery: [{ url: 'https://…/room1.jpg' }, { url: 'https://…/pool.jpg' }],
 *   },
 * });
 * // rows[0] → { sortOrder: 0, isFeatured: true, url: '…/featured.jpg' }
 * // rows[1] → { sortOrder: 1, isFeatured: false, url: '…/room1.jpg' }
 * // rows[2] → { sortOrder: 2, isFeatured: false, url: '…/pool.jpg' }
 * ```
 */
export function buildAccommodationMediaRows({
    accommodationId,
    media
}: BuildAccommodationMediaRowsInput): Partial<AccommodationMedia>[] {
    const rows: Partial<AccommodationMedia>[] = [];
    let nextSortOrder = 0;

    // --- featuredImage ---
    const fi = media.featuredImage;
    if (fi?.url) {
        rows.push({
            accommodationId,
            url: fi.url,
            caption: fi.caption,
            description: fi.description,
            alt: fi.alt,
            publicId: fi.publicId,
            moderationState: ModerationStatusEnum.APPROVED,
            state: 'visible',
            isFeatured: true,
            sortOrder: nextSortOrder,
            archivedAt: null
        });
        nextSortOrder += 1;
    }

    // --- gallery[] ---
    const gallery = media.gallery ?? [];
    for (const entry of gallery) {
        if (!entry?.url) continue;
        rows.push({
            accommodationId,
            url: entry.url,
            caption: entry.caption,
            description: entry.description,
            alt: entry.alt,
            publicId: entry.publicId,
            moderationState: ModerationStatusEnum.APPROVED,
            state: 'visible',
            isFeatured: false,
            sortOrder: nextSortOrder,
            archivedAt: null
        });
        nextSortOrder += 1;
    }

    return rows;
}
