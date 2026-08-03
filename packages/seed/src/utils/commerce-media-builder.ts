/**
 * @file commerce-media-builder.ts
 * @description Fixture `media` block → `gastronomy_media` / `experience_media`
 * rows (HOS-372).
 *
 * Thin per-vertical wrappers over {@link buildMediaRows}: the ordering and
 * defaulting rules are shared with accommodations, and only the owning foreign
 * key differs.
 *
 * @module utils/commerce-media-builder
 */

import type { ExperienceMedia, GastronomyMedia } from '@repo/schemas';
import type { FixtureMediaBlock } from './media-rows-builder.js';
import { buildMediaRows } from './media-rows-builder.js';

/**
 * Maps a gastronomy fixture's `media` block to `gastronomy_media` rows.
 *
 * @param input.gastronomyId - UUID of the listing that owns the photos.
 * @param input.media - The `media` block from the gastronomy JSON fixture.
 * @returns Ordered rows for `GastronomyMediaModel.create()`.
 */
export function buildGastronomyMediaRows({
    gastronomyId,
    media
}: {
    readonly gastronomyId: string;
    readonly media: FixtureMediaBlock;
}): Partial<GastronomyMedia>[] {
    return buildMediaRows({ media }).map((row) => ({ ...row, gastronomyId }));
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
