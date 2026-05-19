/**
 * @file userBookmark.enrichment.ts
 * @description Polymorphic enrichment helper that hydrates bookmarks with the
 * referenced entity's display data (name/title, slug, featured image URL).
 *
 * Bookmarks store only `entityId` + `entityType` polymorphic references. To
 * render a meaningful card (title + image + link), the API needs to JOIN
 * across the four target tables: `accommodations`, `destinations`, `events`,
 * `posts`. Rather than coupling each consumer to the per-entity model layer,
 * this helper batches one query per entity type and returns a lookup map keyed
 * by `entityId`.
 *
 * Used by both `UserBookmarkService.listBookmarksByUser` and
 * `UserBookmarkCollectionService.getCollectionById`.
 */

import { events, type DrizzleClient, accommodations, destinations, getDb, posts } from '@repo/db';
import type { EntityTypeEnum, Media, UserBookmark } from '@repo/schemas';
import { inArray } from 'drizzle-orm';

/**
 * Display data extracted from the referenced entity for rendering a bookmark
 * card. All fields are nullable because the referenced entity may have been
 * soft-deleted or the `entityType` may be one that we do not enrich (e.g.
 * USER, ATTRACTION).
 */
export interface BookmarkEntityInfo {
    /** Display name. Falls back to `posts.title` for POST bookmarks. */
    readonly entityName: string | null;
    /** URL-friendly slug for building the entity detail link. */
    readonly entitySlug: string | null;
    /** Featured image URL extracted from `media.featuredImage.url`. */
    readonly entityImage: string | null;
}

const EMPTY_INFO: BookmarkEntityInfo = {
    entityName: null,
    entitySlug: null,
    entityImage: null
};

type EnrichableEntityType = 'ACCOMMODATION' | 'DESTINATION' | 'EVENT' | 'POST';

const ENRICHABLE_TYPES: readonly EnrichableEntityType[] = [
    'ACCOMMODATION',
    'DESTINATION',
    'EVENT',
    'POST'
] as const;

function extractImageUrl(media: Media | null | undefined): string | null {
    return media?.featuredImage?.url ?? null;
}

/**
 * Bookmark shape returned by enrichment. Extends the persisted UserBookmark
 * with the three nullable entity fields. Consumers that don't need enrichment
 * can keep using plain `UserBookmark`.
 */
export type UserBookmarkWithEntityInfo = UserBookmark & BookmarkEntityInfo;

/**
 * Hydrates each bookmark with display data from the referenced entity.
 *
 * Strategy:
 * 1. Group bookmark entity IDs by `entityType`.
 * 2. Run one batched `SELECT id, name|title, slug, media WHERE id IN (...)`
 *    per known entity type (max 4 queries regardless of bookmark count).
 * 3. Merge the lookup into each bookmark; missing/unknown types leave the
 *    three info fields as `null`.
 *
 * @param bookmarks - Bookmarks to enrich (typically a single page of results)
 * @param tx - Optional Drizzle transaction client; falls back to `getDb()`
 */
export async function enrichBookmarksWithEntityInfo(
    bookmarks: readonly UserBookmark[],
    tx?: DrizzleClient
): Promise<UserBookmarkWithEntityInfo[]> {
    if (bookmarks.length === 0) {
        return [];
    }

    const idsByType = new Map<EnrichableEntityType, string[]>();
    for (const type of ENRICHABLE_TYPES) {
        idsByType.set(type, []);
    }
    for (const bookmark of bookmarks) {
        const list = idsByType.get(bookmark.entityType as EnrichableEntityType);
        if (list) {
            list.push(bookmark.entityId);
        }
    }

    const db = tx ?? getDb();
    const lookup = new Map<string, BookmarkEntityInfo>();

    const accommodationIds = idsByType.get('ACCOMMODATION') ?? [];
    const destinationIds = idsByType.get('DESTINATION') ?? [];
    const eventIds = idsByType.get('EVENT') ?? [];
    const postIds = idsByType.get('POST') ?? [];

    // Run all per-type queries in parallel — they are independent.
    const [accommodationRows, destinationRows, eventRows, postRows] = await Promise.all([
        accommodationIds.length > 0
            ? db
                  .select({
                      id: accommodations.id,
                      name: accommodations.name,
                      slug: accommodations.slug,
                      media: accommodations.media
                  })
                  .from(accommodations)
                  .where(inArray(accommodations.id, accommodationIds))
            : Promise.resolve([]),
        destinationIds.length > 0
            ? db
                  .select({
                      id: destinations.id,
                      name: destinations.name,
                      slug: destinations.slug,
                      media: destinations.media
                  })
                  .from(destinations)
                  .where(inArray(destinations.id, destinationIds))
            : Promise.resolve([]),
        eventIds.length > 0
            ? db
                  .select({
                      id: events.id,
                      name: events.name,
                      slug: events.slug,
                      media: events.media
                  })
                  .from(events)
                  .where(inArray(events.id, eventIds))
            : Promise.resolve([]),
        postIds.length > 0
            ? db
                  .select({
                      id: posts.id,
                      title: posts.title,
                      slug: posts.slug,
                      media: posts.media
                  })
                  .from(posts)
                  .where(inArray(posts.id, postIds))
            : Promise.resolve([])
    ]);

    for (const row of accommodationRows) {
        lookup.set(row.id, {
            entityName: row.name,
            entitySlug: row.slug,
            entityImage: extractImageUrl(row.media)
        });
    }
    for (const row of destinationRows) {
        lookup.set(row.id, {
            entityName: row.name,
            entitySlug: row.slug,
            entityImage: extractImageUrl(row.media)
        });
    }
    for (const row of eventRows) {
        lookup.set(row.id, {
            entityName: row.name,
            entitySlug: row.slug,
            entityImage: extractImageUrl(row.media)
        });
    }
    for (const row of postRows) {
        lookup.set(row.id, {
            entityName: row.title,
            entitySlug: row.slug,
            entityImage: extractImageUrl(row.media)
        });
    }

    return bookmarks.map((bookmark) => ({
        ...bookmark,
        ...(lookup.get(bookmark.entityId) ?? EMPTY_INFO)
    }));
}

/**
 * Convenience export — the list of entity types that this helper enriches.
 * Useful for callers that want to narrow `entityType` filters before calling.
 */
export const ENRICHABLE_BOOKMARK_TYPES: readonly EntityTypeEnum[] =
    ENRICHABLE_TYPES as readonly EntityTypeEnum[];
