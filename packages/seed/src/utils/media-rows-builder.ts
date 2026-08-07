/**
 * @file media-rows-builder.ts
 * @description Vertical-agnostic mapping from a fixture's `media` block to
 * relational media rows (HOS-372).
 *
 * Accommodations, gastronomy listings and experiences all keep their photos in
 * per-vertical tables (`accommodation_media`, `gastronomy_media`,
 * `experience_media`) that mirror each other exactly. The only thing that
 * differs between them is the name of the owning foreign key, so the ordering
 * and defaulting rules live here ONCE and each vertical's builder just stamps
 * its own FK on top. Three copies of this would drift.
 *
 * @module utils/media-rows-builder
 */

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
    /**
     * Per-image moderation state. Defaults to `APPROVED` when omitted, since
     * seed content is curated and pre-vetted. Declared as the enum's string
     * union so fixtures can keep writing the plain `'APPROVED'` literal that
     * the JSON files already carry, with no cast at the call site.
     *
     * Fixtures that deliberately exercise the rejected-moderation branch set
     * `REJECTED` here — see the moderation conventions in the package README.
     */
    readonly moderationState?: `${ModerationStatusEnum}`;
}

/**
 * The `media` block shape used in fixtures.
 *
 * Videos are intentionally excluded: they are external YouTube/Vimeo URLs, not
 * uploaded assets, so they live in each entity's own `videos` column rather
 * than in the media tables (HOS-372 decision).
 */
export interface FixtureMediaBlock {
    readonly featuredImage?: FixtureImageEntry;
    readonly gallery?: FixtureImageEntry[];
}

/** A media row with every column set except the owning foreign key. */
export interface MediaRowWithoutOwner {
    readonly url: string;
    readonly caption?: string;
    readonly description?: string;
    readonly alt?: string;
    readonly publicId?: string;
    readonly moderationState: ModerationStatusEnum;
    readonly state: 'visible';
    readonly isFeatured: boolean;
    readonly sortOrder: number;
    readonly archivedAt: null;
}

/**
 * Resolves an image's moderation state, defaulting to `APPROVED`.
 *
 * Seed content is curated and pre-vetted, so an omitted state means approved
 * rather than pending — seeding `PENDING` would simulate a state the moderation
 * pipeline never produced. An explicit value is honoured so fixtures can still
 * exercise the rejected branch.
 */
function resolveModerationState(
    value: `${ModerationStatusEnum}` | undefined
): ModerationStatusEnum {
    return (value as ModerationStatusEnum | undefined) ?? ModerationStatusEnum.APPROVED;
}

/**
 * Maps a fixture `media` block to ordered, owner-less media rows.
 *
 * Rules:
 * - `featuredImage` → `isFeatured = true`, `sortOrder = 0`, emitted first.
 * - `gallery[]` → `isFeatured = false`, `sortOrder` ascending from the next
 *   free slot (0 with no featured image, 1 when featured occupies slot 0).
 * - Every row is `visible` and never archived; moderation defaults to
 *   `APPROVED` unless the fixture states otherwise.
 * - Entries with an empty or missing URL are skipped.
 * - At most ONE row is featured, satisfying the single-featured unique index.
 *
 * Pure transformation — performs no I/O, so it is unit-testable without a DB.
 *
 * @param input.media - The `media` block from a fixture.
 * @returns Ordered rows awaiting their owning foreign key.
 */
export function buildMediaRows({
    media
}: {
    readonly media: FixtureMediaBlock;
}): MediaRowWithoutOwner[] {
    const rows: MediaRowWithoutOwner[] = [];
    let nextSortOrder = 0;

    const featured = media.featuredImage;
    if (featured?.url) {
        rows.push({
            url: featured.url,
            caption: featured.caption,
            description: featured.description,
            alt: featured.alt,
            publicId: featured.publicId,
            moderationState: resolveModerationState(featured.moderationState),
            state: 'visible',
            isFeatured: true,
            sortOrder: nextSortOrder,
            archivedAt: null
        });
        nextSortOrder += 1;
    }

    for (const entry of media.gallery ?? []) {
        if (!entry?.url) continue;
        rows.push({
            url: entry.url,
            caption: entry.caption,
            description: entry.description,
            alt: entry.alt,
            publicId: entry.publicId,
            moderationState: resolveModerationState(entry.moderationState),
            state: 'visible',
            isFeatured: false,
            sortOrder: nextSortOrder,
            archivedAt: null
        });
        nextSortOrder += 1;
    }

    return rows;
}
