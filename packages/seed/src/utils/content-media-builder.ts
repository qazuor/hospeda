/**
 * @file content-media-builder.ts
 * @description Fixture `media` block → `post_media` / `event_media` rows
 * (HOS-390).
 *
 * Thin per-entity wrappers over {@link buildMediaRows}, exactly like
 * `commerce-media-builder.ts`: the ordering and defaulting rules are shared with
 * accommodations and commerce listings, and only the owning foreign key differs.
 *
 * @module utils/content-media-builder
 */

import type { EventMedia, PostMedia } from '@repo/schemas';
import type { FixtureMediaBlock } from './media-rows-builder.js';
import { buildMediaRows } from './media-rows-builder.js';

/**
 * Maps a post fixture's `media` block to `post_media` rows.
 *
 * @param input.postId - UUID of the post that owns the photos.
 * @param input.media - The `media` block from the post JSON fixture.
 * @returns Ordered rows for `PostMediaModel.create()`.
 */
export function buildPostMediaRows({
    postId,
    media
}: {
    readonly postId: string;
    readonly media: FixtureMediaBlock;
}): Partial<PostMedia>[] {
    return buildMediaRows({ media }).map((row) => ({ ...row, postId }));
}

/**
 * Maps an event fixture's `media` block to `event_media` rows.
 *
 * @param input.eventId - UUID of the event that owns the photos.
 * @param input.media - The `media` block from the event JSON fixture.
 * @returns Ordered rows for `EventMediaModel.create()`.
 */
export function buildEventMediaRows({
    eventId,
    media
}: {
    readonly eventId: string;
    readonly media: FixtureMediaBlock;
}): Partial<EventMedia>[] {
    return buildMediaRows({ media }).map((row) => ({ ...row, eventId }));
}
