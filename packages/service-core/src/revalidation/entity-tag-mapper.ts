/**
 * @fileoverview
 * Maps an entity change to the Cloudflare cache tags that must be purged.
 *
 * This replaces `entity-path-mapper.ts` — 466 lines that reimplemented the web
 * app's routing table by hand, in a different package, and had already drifted
 * from it (HOS-369 §5.11.1, D-6). The drift was not cosmetic: for `es`, the
 * default locale and effectively all human traffic, it emitted redirect URLs
 * rather than content URLs, so every Spanish purge would have addressed a URL
 * that was never cached — invisible under `purge_everything`, fatal under
 * selective purge.
 *
 * Tags remove the need for that table entirely. A tag names WHAT a response
 * contains, so this module never has to know which URL renders it, how many
 * locales exist, or which query-string variants are cacheable. That last point
 * is decisive rather than merely convenient: on the Free plan the cache key
 * keeps the query string, so `?page=2` and `?sortBy=price` variants can never
 * be reached by exact-URL purge (§5.11.2). They carry the same tags as the
 * page they vary, and a tag purge takes all of them at once.
 *
 * The mapping below is a faithful translation of what the path mapper INTENDED
 * to invalidate. Where the old module enumerated facet pages one by one
 * (`/alojamientos/tipo/{type}/`, `/alojamientos/comodidades/{amenity}/`, …),
 * the collection tag covers all of them, because every one of those pages is a
 * listing of the same collection and emits `list-accom`.
 *
 * All exports are pure — no I/O, no throwing.
 */

import { buildEntityCacheTags, CACHE_TAG_COLLECTIONS, CACHE_TAG_HOME } from '@repo/cache-tags';
import type { EntityChangeData } from './entity-change.types.js';

/**
 * Return every cache tag that must be purged when an entity changes.
 *
 * Unlike its path-based predecessor this takes no `locales` argument. A tag is
 * locale-agnostic by construction: the `es`, `en` and `pt` renders of an
 * accommodation all carry `accom-<slug>`, so one tag purges all three. The
 * old signature's locale fan-out existed only because a URL had to name one.
 *
 * @param event - The entity change, with whatever context the call site had.
 * @returns Deduplicated tags to purge. Never empty for a known entity type —
 *   an event with no identifying key still yields its collection tag, which is
 *   the honest answer: something in that collection changed, we do not know
 *   which member.
 *
 * @example
 * ```ts
 * getAffectedCacheTags({
 *   entityType: 'accommodation',
 *   slug: 'cabana-del-rio',
 *   destinationSlug: 'concordia'
 * });
 * // ['accom-cabana-del-rio', 'list-accom', 'home', 'dest-concordia']
 * ```
 */
export function getAffectedCacheTags(event: EntityChangeData): readonly string[] {
    const tags = new Set<string>();

    switch (event.entityType) {
        case 'accommodation': {
            for (const tag of buildEntityCacheTags({
                entity: 'accommodation',
                slug: event.slug,
                id: event.id
            })) {
                tags.add(tag);
            }
            // Every accommodation listing surface — the base listing, the type
            // landings, the amenity and feature filter pages — emits this one
            // tag, so it stands in for the ~40 URLs the path mapper enumerated.
            tags.add(CACHE_TAG_COLLECTIONS.accommodation);
            // The home page shows featured accommodations (SPEC-092 T-018).
            tags.add(CACHE_TAG_HOME);
            // The parent destination page lists its accommodations.
            if (event.destinationSlug) {
                for (const tag of buildEntityCacheTags({
                    entity: 'destination',
                    slug: event.destinationSlug
                })) {
                    tags.add(tag);
                }
            }
            break;
        }

        case 'destination': {
            for (const tag of buildEntityCacheTags({
                entity: 'destination',
                slug: event.slug,
                id: event.id
            })) {
                tags.add(tag);
            }
            tags.add(CACHE_TAG_COLLECTIONS.destination);
            tags.add(CACHE_TAG_HOME);
            // Accommodation listings render their destination's name/region, so
            // a destination rename changes them too. The path mapper made the
            // same call.
            tags.add(CACHE_TAG_COLLECTIONS.accommodation);
            break;
        }

        case 'event': {
            for (const tag of buildEntityCacheTags({
                entity: 'event',
                slug: event.slug,
                id: event.id
            })) {
                tags.add(tag);
            }
            tags.add(CACHE_TAG_COLLECTIONS.event);
            tags.add(CACHE_TAG_HOME);
            if (event.destinationSlug) {
                for (const tag of buildEntityCacheTags({
                    entity: 'destination',
                    slug: event.destinationSlug
                })) {
                    tags.add(tag);
                }
            }
            break;
        }

        case 'post': {
            for (const tag of buildEntityCacheTags({
                entity: 'post',
                slug: event.slug,
                id: event.id
            })) {
                tags.add(tag);
            }
            tags.add(CACHE_TAG_COLLECTIONS.post);
            tags.add(CACHE_TAG_HOME);
            break;
        }

        case 'accommodation_review': {
            // A review changes the parent's rating, which appears both on its
            // detail page and on every card of it in a listing.
            if (event.accommodationSlug) {
                for (const tag of buildEntityCacheTags({
                    entity: 'accommodation',
                    slug: event.accommodationSlug
                })) {
                    tags.add(tag);
                }
            }
            tags.add(CACHE_TAG_COLLECTIONS.accommodation);
            break;
        }

        case 'destination_review': {
            if (event.destinationSlug) {
                for (const tag of buildEntityCacheTags({
                    entity: 'destination',
                    slug: event.destinationSlug
                })) {
                    tags.add(tag);
                }
            }
            tags.add(CACHE_TAG_COLLECTIONS.destination);
            break;
        }

        case 'gastronomy':
        case 'experience': {
            // Both are commerce listings with the same shape: a detail page and
            // a listing page of their own, optionally tied to one destination.
            // `event.entityType` is the discriminant, so this shared arm stays
            // exact rather than guessing.
            for (const tag of buildEntityCacheTags({
                entity: event.entityType,
                slug: event.slug,
                id: event.id
            })) {
                tags.add(tag);
            }
            tags.add(CACHE_TAG_COLLECTIONS[event.entityType]);
            // Deliberately NOT `CACHE_TAG_HOME`: unlike accommodations, events
            // and posts, the home page does not surface commerce listings.
            // Adding it would evict the home on every restaurant edit for no
            // reason.
            if (event.destinationSlug) {
                for (const tag of buildEntityCacheTags({
                    entity: 'destination',
                    slug: event.destinationSlug
                })) {
                    tags.add(tag);
                }
            }
            break;
        }

        case 'attraction':
        case 'pointOfInterest': {
            // Both have a detail page but NO listing page anywhere, which is
            // why neither has a collection tag (see `CACHE_TAG_COLLECTIONS`).
            for (const tag of buildEntityCacheTags({
                entity: event.entityType,
                slug: event.slug,
                id: event.id
            })) {
                tags.add(tag);
            }
            // Fan out across EVERY destination that shows this entity. The
            // relation is many-to-many in both cases, so this loop is the
            // difference between a correct purge and one that quietly evicts
            // a single destination and leaves the others stale — a failure
            // that reports success and is invisible until somebody notices a
            // renamed POI still showing its old name on four destination
            // pages.
            for (const destinationSlug of event.destinationSlugs ?? []) {
                if (!destinationSlug) continue;
                for (const tag of buildEntityCacheTags({
                    entity: 'destination',
                    slug: destinationSlug
                })) {
                    tags.add(tag);
                }
            }
            break;
        }

        case 'tag':
        case 'amenity': {
            // Neither has a page of its own; both are accommodation filters.
            tags.add(CACHE_TAG_COLLECTIONS.accommodation);
            break;
        }

        default: {
            // Unknown entity type — no tags. Deliberately not a throw: this is
            // called from fire-and-forget service hooks where a throw would
            // surface as a failed write of unrelated content.
            break;
        }
    }

    return Array.from(tags);
}
