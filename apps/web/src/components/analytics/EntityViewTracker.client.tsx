/**
 * @file EntityViewTracker.client.tsx
 * @description Headless React island that fires a typed PostHog event and a
 * view beacon once when a post or event detail page hydrates (SPEC-159 T-013).
 * Widened by HOS-734 to also capture the view beacon (no PostHog funnel event
 * yet) on gastronomy and experience detail pages — the plumbing that feeds
 * the owner-facing "basic view stats" widget in `mi-cuenta/comercio`.
 *
 * Renders nothing. Mount in detail pages with `client:idle` so it never
 * competes with above-the-fold rendering.
 *
 * The PostHog events are explicit (not relying on autocapture `$pageview`)
 * because we want typed props (slug, post_id / event_id, locale) that funnels
 * can filter against without parsing the URL. GASTRONOMY and EXPERIENCE do
 * NOT get a dedicated PostHog event here (owner decision, HOS-734): a
 * marketing-analytics funnel for commerce views is out of scope for the
 * "básicas" this issue covers — only the `entity_views` capture (which feeds
 * the real owner-facing stat) is wired for them.
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
 * Both the PostHog call and the beacon are inside the same `useEffect` with
 * the same dependency array so they fire together on every mount. There is no
 * double-fire risk from React StrictMode double-invocation in tests because:
 *  - `trackEvent` is a no-op when `window.posthog` is absent (dev/test).
 *  - `sendViewBeacon` is a no-op when `navigator` is undefined (SSR/test).
 * In production builds StrictMode is disabled, so the effect runs once only.
 */

import { EntityTypeEnum } from '@repo/schemas';
import { useEffect } from 'react';
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/posthog-client';
import { sendViewBeacon } from '@/lib/analytics/view-capture';
import type { SupportedLocale } from '@/lib/i18n';

/**
 * The entity types this tracker currently supports.
 * POST and EVENT each have a corresponding PostHog event in the catalog.
 * GASTRONOMY and EXPERIENCE (HOS-734) and PARTNER (HOS-1063) capture the view
 * beacon only — see the file header for why no PostHog event is fired for them.
 *
 * This list had DRIFTED from the server's `TRACKABLE_ENTITY_TYPES`, which has
 * carried ACCOMMODATION all along while this one never did. The drift is
 * harmless in that direction (the client offers fewer types than the server
 * accepts, and accommodations are tracked by their own dedicated island), but it
 * is worth knowing about before assuming the two lists mirror each other.
 */
type SupportedEntityType = 'POST' | 'EVENT' | 'GASTRONOMY' | 'EXPERIENCE' | 'PARTNER';

/**
 * Props for {@link EntityViewTracker}.
 */
interface EntityViewTrackerProps {
    /** Entity category: must be 'POST' or 'EVENT'. */
    readonly entityType: SupportedEntityType;
    /** URL slug of the entity (used as a PostHog prop for funnel filtering). */
    readonly slug: string;
    /** UUID of the viewed entity. Passed to the view beacon; NOT the slug. */
    readonly entityId: string;
    /** Active locale for the PostHog event payload. */
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
    GASTRONOMY: EntityTypeEnum.GASTRONOMY,
    EXPERIENCE: EntityTypeEnum.EXPERIENCE,
    PARTNER: EntityTypeEnum.PARTNER
} as const satisfies Record<SupportedEntityType, (typeof EntityTypeEnum)[SupportedEntityType]>;

/**
 * Headless React island that fires analytics on post, event, gastronomy, and
 * experience detail page views (HOS-734 widened the last two).
 *
 * On each mount it:
 *  1. For POST/EVENT: fires the typed PostHog event (`post_viewed` /
 *     `event_viewed`) with slug, entity id, and locale (SPEC-159 T-013). For
 *     GASTRONOMY/EXPERIENCE: no PostHog event yet — see the file header.
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
                // GASTRONOMY / EXPERIENCE (HOS-734): entity_views capture only.
                // No dedicated PostHog funnel event yet — advanced commerce
                // analytics (QR scans, dish views, origin destinations) will
                // define their own event catalog in a follow-up spec.
                break;
        }

        sendViewBeacon({ entityType: ENTITY_TYPE_ENUM_MAP[entityType], entityId });
    }, [entityType, slug, entityId, locale]);

    return null;
}
