/**
 * @file listing-media-builder.ts
 * @description Fixture `media` block → `venue_media` / `experience_media`
 * rows (HOS-372).
 *
 * Thin per-vertical wrappers over {@link buildMediaRows}: the ordering and
 * defaulting rules are shared with accommodations, and only the owning foreign
 * key differs.
 *
 * @module utils/listing-media-builder
 */

import type { ExperienceMedia, VenueMedia } from '@repo/schemas';
import type { FixtureMediaBlock } from './media-rows-builder.js';
import { buildMediaRows } from './media-rows-builder.js';

/**
 * Maps a venue fixture's `media` block to `venue_media` rows.
 *
 * @param input.venueId - UUID of the listing that owns the photos.
 * @param input.media - The `media` block from the venue JSON fixture.
 * @returns Ordered rows for `venueMediaModel.create()`.
 */
export function buildVenueMediaRows({
    venueId,
    media
}: {
    readonly venueId: string;
    readonly media: FixtureMediaBlock;
}): Partial<VenueMedia>[] {
    return buildMediaRows({ media }).map((row) => ({ ...row, venueId }));
}

/**
 * Maps an experience fixture's `media` block to `experience_media` rows.
 *
 * @param input.experienceId - UUID of the listing that owns the photos.
 * @param input.media - The `media` block from the experience fixture.
 * @returns Ordered rows for `ExperienceMediaModel.create()`.
 */
export function buildExperienceMediaRows({
    experienceId,
    media
}: {
    readonly experienceId: string;
    readonly media: FixtureMediaBlock;
}): Partial<ExperienceMedia>[] {
    return buildMediaRows({ media }).map((row) => ({ ...row, experienceId }));
}
