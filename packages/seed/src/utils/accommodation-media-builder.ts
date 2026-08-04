import type { AccommodationMedia } from '@repo/schemas';
import type { FixtureMediaBlock } from './media-rows-builder.js';
import { buildMediaRows } from './media-rows-builder.js';

export type { FixtureImageEntry, FixtureMediaBlock } from './media-rows-builder.js';

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
 * Ordering, defaulting and skip rules live in {@link buildMediaRows}, shared
 * with the gastronomy and experience builders (HOS-372) — the three media
 * tables are identical apart from the owning foreign key stamped here.
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
    return buildMediaRows({ media }).map((row) => ({ ...row, accommodationId }));
}
