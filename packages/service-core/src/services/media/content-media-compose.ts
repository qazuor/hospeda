/**
 * content-media-compose.ts
 *
 * Read-composition entry point for EDITORIAL content media (`post_media`,
 * `event_media` — HOS-390): rebuilds the `Media` shape consumers expect from
 * the relational rows plus the entity's videos.
 *
 * ## Why this delegates instead of implementing
 *
 * The composition rules for a content media row are byte-for-byte the rules for
 * a commerce media row: `BaseContentMediaSchema` and `BaseCommerceMediaSchema`
 * declare the same fields with the same semantics (see the "third copy of the
 * same shape" note in `common/content-media.schema.ts`), so `PostMedia` and
 * `EventMedia` are structurally assignable to `BaseCommerceMedia` and
 * {@link composeCommerceMedia} already produces exactly the right output.
 *
 * Writing a fourth copy of `filter → sort → map` here would give the two
 * verticals independent bugs — the failure mode being a gallery that orders
 * correctly for a gastronomy listing and not for a post. Delegating keeps ONE
 * implementation while letting post/event code import a content-named symbol
 * instead of reaching into `services/commerce/`.
 *
 * The pending cleanup (tracked in `common/content-media.schema.ts`) is to
 * collapse the schema copies into one `BaseEntityMediaSchema`; when that lands,
 * the underlying function gets a neutral name and this module becomes its only
 * caller-facing alias, or disappears.
 *
 * ## Videos
 *
 * Unlike commerce listings (dedicated `videos` column) posts and events keep
 * their videos in the `media` JSONB blob — a video is an external YouTube/Vimeo
 * URL, not an uploaded asset, so HOS-390 never migrated it (SPEC-204 D1) and the
 * `media` column is NOT dropped. Callers therefore pass `entity.media?.videos`.
 *
 * @module content-media-compose
 */

import type { BaseContentMedia, Media, Video } from '@repo/schemas';
import { composeCommerceMedia } from '../commerce/commerce-media-compose';

/**
 * Inputs required by {@link composeContentMedia}.
 */
export interface ComposeContentMediaInput {
    /**
     * All non-deleted media rows for one post or event, in any order (the
     * composer re-sorts by `sortOrder`). May include both `visible` and
     * `archived` rows.
     */
    readonly rows: readonly BaseContentMedia[];
    /**
     * The entity's videos, read from the `media` JSONB blob
     * (`entity.media?.videos`) — NOT from a relational row. Passed through
     * unchanged; composition never inspects or reorders it.
     */
    readonly videos?: readonly Video[] | null;
}

/**
 * Composes the `Media` shape from relational post/event media rows plus the
 * entity's videos.
 *
 * Output rules (each field is omitted when empty, producing a sparse object):
 *  - `featuredImage`   — the single `isFeatured` visible row, when one exists.
 *  - `gallery`         — visible non-featured rows, ordered by `sortOrder ASC`.
 *  - `archivedGallery` — archived rows, ordered by `sortOrder ASC`.
 *  - `videos`          — the incoming array, when non-empty.
 *
 * The result is a fresh object; neither `rows` nor `videos` is mutated.
 *
 * @param input - {@link ComposeContentMediaInput}
 * @returns The composed {@link Media} object (possibly empty `{}`).
 *
 * @example
 * ```ts
 * const media = composeContentMedia({ rows: postMediaRows, videos: post.media?.videos });
 * ```
 */
export function composeContentMedia(input: ComposeContentMediaInput): Media {
    return composeCommerceMedia({ rows: input.rows, videos: input.videos });
}
