/**
 * @fileoverview
 * Answers, at send time, whether an entity is still publicly visible
 * (HOS-585 AC-4).
 *
 * **Why this exists at all.** IndexNow rides `scheduleRevalidation`, and a cache
 * purge and a search notification want opposite things from an unpublish:
 * evicting the page that just disappeared is the entire point of purging, so
 * that hook fires on `ACTIVE → DRAFT` deliberately. Announcing the same URL to a
 * search engine advertises a page that now 404s, which is exactly what the
 * protocol penalizes.
 *
 * **Why not the existing `EntityResolver`.** Its JSDoc claims it looks up
 * "published entities", but its queries filter on the primary key alone — it
 * would answer `true` for a listing unpublished a second ago. Reusing it would
 * have looked correct and been wrong.
 *
 * Lives in the API layer for the same reason `entity-resolver.ts` does: it
 * depends on concrete Drizzle schemas.
 */

import {
    accommodations,
    and,
    destinations,
    eq,
    events,
    experiences,
    gastronomies,
    getDb,
    isNull,
    posts
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { LifecycleStatusEnum, VisibilityEnum } from '@repo/schemas';
import type { NotifiableEntity } from '@repo/service-core';

const logger = createLogger('indexnow-visibility');

/**
 * One lookup: "does a publicly-served row with this slug exist?".
 *
 * Written out once per table rather than once generically because Drizzle
 * parameterises every column type by its table name — a shared helper would
 * need a cast, and a cast here would turn a future column rename into a runtime
 * failure instead of a compile error. That is the one thing this module cannot
 * afford to get wrong quietly.
 */
type VisibilityLookup = (slug: string) => Promise<boolean>;

/**
 * The repo-wide definition of "the public site serves this": published, public,
 * and not soft-deleted.
 *
 * The first two conditions are the same pair `AccommodationService._isPubliclyVisible`
 * and `isCommerceListingPubliclyVisible` already use. The third is added here
 * because those two receive a live row and never have to ask.
 */
const ACTIVE = LifecycleStatusEnum.ACTIVE;
const PUBLIC = VisibilityEnum.PUBLIC;

/**
 * Where each notifiable entity type's public page comes from.
 *
 * Keyed by the entity types `toNotifiableEntity` can emit. A type absent here
 * is refused rather than assumed public.
 */
const VISIBILITY_LOOKUPS: Readonly<Record<string, VisibilityLookup>> = {
    accommodation: async (slug) =>
        (
            await getDb()
                .select({ slug: accommodations.slug })
                .from(accommodations)
                .where(
                    and(
                        eq(accommodations.slug, slug),
                        eq(accommodations.lifecycleState, ACTIVE),
                        eq(accommodations.visibility, PUBLIC),
                        isNull(accommodations.deletedAt)
                    )
                )
                .limit(1)
        ).length > 0,

    destination: async (slug) =>
        (
            await getDb()
                .select({ slug: destinations.slug })
                .from(destinations)
                .where(
                    and(
                        eq(destinations.slug, slug),
                        eq(destinations.lifecycleState, ACTIVE),
                        eq(destinations.visibility, PUBLIC),
                        isNull(destinations.deletedAt)
                    )
                )
                .limit(1)
        ).length > 0,

    event: async (slug) =>
        (
            await getDb()
                .select({ slug: events.slug })
                .from(events)
                .where(
                    and(
                        eq(events.slug, slug),
                        eq(events.lifecycleState, ACTIVE),
                        eq(events.visibility, PUBLIC),
                        isNull(events.deletedAt)
                    )
                )
                .limit(1)
        ).length > 0,

    post: async (slug) =>
        (
            await getDb()
                .select({ slug: posts.slug })
                .from(posts)
                .where(
                    and(
                        eq(posts.slug, slug),
                        eq(posts.lifecycleState, ACTIVE),
                        eq(posts.visibility, PUBLIC),
                        isNull(posts.deletedAt)
                    )
                )
                .limit(1)
        ).length > 0,

    gastronomy: async (slug) =>
        (
            await getDb()
                .select({ slug: gastronomies.slug })
                .from(gastronomies)
                .where(
                    and(
                        eq(gastronomies.slug, slug),
                        eq(gastronomies.lifecycleState, ACTIVE),
                        eq(gastronomies.visibility, PUBLIC),
                        isNull(gastronomies.deletedAt)
                    )
                )
                .limit(1)
        ).length > 0,

    experience: async (slug) =>
        (
            await getDb()
                .select({ slug: experiences.slug })
                .from(experiences)
                .where(
                    and(
                        eq(experiences.slug, slug),
                        eq(experiences.lifecycleState, ACTIVE),
                        eq(experiences.visibility, PUBLIC),
                        isNull(experiences.deletedAt)
                    )
                )
                .limit(1)
        ).length > 0
};

/** The entity types this module can vouch for, for the guard test. */
export const VISIBILITY_CHECKED_ENTITY_TYPES = Object.keys(VISIBILITY_LOOKUPS);

/**
 * Whether the public site would still serve this entity's detail page.
 *
 * Fails CLOSED on every uncertainty — an unknown entity type, a missing row, or
 * a database error all answer `false`. Not announcing a page that is in fact
 * live costs one crawl cycle; announcing one that is gone costs standing with
 * the protocol.
 *
 * @param entity - The entity a notification is about to be sent for.
 * @returns Whether it is publicly visible right now.
 */
export async function isEntityPubliclyVisible(entity: NotifiableEntity): Promise<boolean> {
    const lookup = VISIBILITY_LOOKUPS[entity.entityType];
    if (!lookup) {
        logger.warn(
            `[IndexNow] No visibility source for entity type "${entity.entityType}" — not announcing it`
        );
        return false;
    }

    try {
        return await lookup(entity.slug);
    } catch (error) {
        logger.error(
            `[IndexNow] Visibility check failed for ${entity.entityType}:${entity.slug} — not announcing it: ${error instanceof Error ? error.message : String(error)}`
        );
        return false;
    }
}
