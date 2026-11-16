/**
 * @file EntityViewTracker.client.tsx
 * @description Headless React island that fires a typed Umami event and a
 * view beacon once when a post, event, venue, experience or partner detail page
 * hydrates (SPEC-159 T-013, HOS-734, HOS-2119 T-030).
 *
 * Renders nothing. Mount in detail pages with `client:idle` so it never
 * competes with above-the-fold rendering.
 *
 * Events per entity type:
 *  - POST / EVENT: `post_viewed` / `event_viewed` (unchanged).
 *  - VENUE / EXPERIENCE / PARTNER: generic `entity_viewed`
 *    `{ entity_type, entity_id, locale }`, where `entity_id` is the listing id.
 *    The owner-facing stats filter on it.
 *
 * ## View Transitions / remount behaviour
 *
 * This island is mounted with `client:idle`. Under Astro View Transitions,
 * React islands do NOT persist across navigations unless `transition:persist`
 * is explicitly set on their host element. Detail pages do NOT use
 * `transition:persist` on the tracker host, so each navigation to a new
 * detail page swaps the DOM node and causes the island to unmount and remount
 * with the new props. The `useEffect` therefore runs once per navigation.
 *
 * Both the Umami call and the beacon are inside the same `useEffect` with
 * the same dependency array so they fire together on every mount.
 */

import { EntityTypeEnum } from '@repo/schemas';
import { useEffect } from 'react';
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/umami-client';
import { sendViewBeacon } from '@/lib/analytics/view-capture';
import type { SupportedLocale } from '@/lib/i18n';

/**
 * The entity types this tracker currently supports.
 * POST and EVENT each have a dedicated event in the catalog; VENUE, EXPERIENCE
 * and PARTNER emit the generic `entity_viewed` event.
 *
 * This list had DRIFTED from the server's `TRACKABLE_ENTITY_TYPES`, which has
 * carried ACCOMMODATION all along while this one never did. The drift is
 * harmless in that direction (the client offers fewer types than the server
 * accepts, and accommodations are tracked by their own dedicated island), but it
 * is worth knowing about before assuming the two lists mirror each other.
 */
type SupportedEntityType = 'POST' | 'EVENT' | 'VENUE' | 'EXPERIENCE' | 'PARTNER';

/**
 * Props for {@link EntityViewTracker}.
 */
interface EntityViewTrackerProps {
    /** Entity category: must be 'POST' or 'EVENT'. */
    readonly entityType: SupportedEntityType;
    /** URL slug of the entity (used as an event prop for filtering). */
    readonly slug: string;
    /** UUID of the viewed entity. Passed to the view beacon; NOT the slug. */
    readonly entityId: string;
    /** Active locale for the event payload. */
    readonly locale: SupportedLocale;
}

/**
 * Map from supported entity type to the EntityTypeEnum runtime member.
 * Keeps the switch logic out of the component body and avoids string literals
 * after the initial discriminant check.
 */
const ENTITY_TYPE_ENUM_MAP = {
    POST: EntityTypeEnum.POST,
    EVENT: EntityTypeEnum.EVENT,
    VENUE: EntityTypeEnum.VENUE,
    EXPERIENCE: EntityTypeEnum.EXPERIENCE,
    PARTNER: EntityTypeEnum.PARTNER
} as const satisfies Record<SupportedEntityType, EntityTypeEnum>;

/**
 * Headless React island that fires analytics on post, event, venue, and
 * experience detail page views (HOS-734 widened the last two).
 *
 * On each mount it:
 *  1. For POST/EVENT: fires the typed Umami event (`post_viewed` /
 *     `event_viewed`) with slug, entity id, and locale (SPEC-159 T-013). For
 *     VENUE/EXPERIENCE/PARTNER: fires `entity_viewed`.
 *  2. Sends a view beacon to `POST /api/v1/public/views` (SPEC-159 T-013,
 *     widened HOS-734) for every supported entity type.
 *
 * Returns `null` — no DOM output.
 */
export function EntityViewTracker({
    entityType,
    slug,
    entityId,
    locale
}: EntityViewTrackerProps): null {
    useEffect(() => {
        switch (entityType) {
            case 'POST':
                trackEvent(WebEvents.PostViewed, {
                    post_id: entityId,
                    post_slug: slug,
                    locale,
                    source_page: 'post_detail'
                });
                break;
            case 'EVENT':
                trackEvent(WebEvents.EventViewed, {
                    event_id: entityId,
                    event_slug: slug,
                    locale,
                    source_page: 'event_detail'
                });
                break;
            default:
                // VENUE / EXPERIENCE / PARTNER (HOS-2119): generic `entity_viewed`
                // keyed by the listing id, which the owner stats filter on.
                trackEvent(WebEvents.EntityViewed, {
                    entity_type: entityType,
                    entity_id: entityId,
                    locale
                });
                break;
        }

        sendViewBeacon({ entityType: ENTITY_TYPE_ENUM_MAP[entityType], entityId });
    }, [entityType, slug, entityId, locale]);

    return null;
}
