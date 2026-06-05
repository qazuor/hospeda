/**
 * @file EntityViewTracker.client.tsx
 * @description Headless React island that fires a typed PostHog event and a
 * view beacon once when a post or event detail page hydrates (SPEC-159 T-013).
 *
 * Renders nothing. Mount in detail pages with `client:idle` so it never
 * competes with above-the-fold rendering.
 *
 * The PostHog events are explicit (not relying on autocapture `$pageview`)
 * because we want typed props (slug, post_id / event_id, locale) that funnels
 * can filter against without parsing the URL.
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

import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/posthog-client';
import { sendViewBeacon } from '@/lib/analytics/view-capture';
import type { SupportedLocale } from '@/lib/i18n';
import { EntityTypeEnum } from '@repo/schemas';
import { useEffect } from 'react';

/**
 * The entity types this tracker currently supports.
 * POST and EVENT each have a corresponding PostHog event in the catalog.
 */
type SupportedEntityType = 'POST' | 'EVENT';

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
    EVENT: EntityTypeEnum.EVENT
} as const satisfies Record<SupportedEntityType, (typeof EntityTypeEnum)[SupportedEntityType]>;

/**
 * Headless React island that fires analytics on post and event detail page views.
 *
 * On each mount it:
 *  1. Fires the typed PostHog event (`post_viewed` or `event_viewed`) with
 *     slug, entity id, and locale (SPEC-159 T-013).
 *  2. Sends a view beacon to `POST /api/v1/public/views` (SPEC-159 T-013).
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
        if (entityType === 'POST') {
            trackEvent(WebEvents.PostViewed, {
                slug,
                post_id: entityId,
                locale
            });
        } else {
            trackEvent(WebEvents.EventViewed, {
                slug,
                event_id: entityId,
                locale
            });
        }

        sendViewBeacon({ entityType: ENTITY_TYPE_ENUM_MAP[entityType], entityId });
    }, [entityType, slug, entityId, locale]);

    return null;
}
