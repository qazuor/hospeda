/**
 * @file AccommodationViewTracker.client.tsx
 * @description Headless React island that fires the
 * `accommodation_viewed` PostHog event once when an accommodation
 * detail page hydrates (SPEC-140 T-140-11).
 *
 * Renders nothing. Mounted in `apps/web/src/pages/[lang]/alojamientos/[slug].astro`
 * with `client:idle` so it never competes with above-the-fold rendering.
 *
 * The event is intentionally explicit (not relying on PostHog autocapture
 * `$pageview`) because we want typed props (slug, accommodation_id, locale)
 * that funnels in PostHog can filter against without parsing the URL.
 */

import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/posthog-client';
import { sendViewBeacon } from '@/lib/analytics/view-capture';
import type { SupportedLocale } from '@/lib/i18n';
import { EntityTypeEnum } from '@repo/schemas';
import { useEffect } from 'react';

interface AccommodationViewTrackerProps {
    readonly slug: string;
    readonly accommodationId: string;
    readonly locale: SupportedLocale;
}

/**
 * Headless React island that fires analytics on accommodation detail page view.
 *
 * On each mount (which in Astro + View Transitions maps to each full-page
 * navigation to an accommodation page) it:
 *  1. Fires the `accommodation_viewed` PostHog event (SPEC-140 T-140-11).
 *  2. Sends a view beacon to `POST /api/v1/public/views` (SPEC-159 T-012).
 *
 * ## View Transitions / remount behaviour
 *
 * This island is mounted with `client:idle`. Under Astro View Transitions,
 * React islands do NOT persist across navigations unless `transition:persist`
 * is explicitly set on their host element. The accommodation detail page does
 * NOT use `transition:persist` on the tracker host, so each navigation to a
 * new accommodation page swaps the DOM node and causes the island to unmount
 * and remount with the new props. The `useEffect` therefore runs once per
 * navigation — identical to the behaviour before this change.
 *
 * Both the PostHog call and the beacon are inside the same `useEffect` with
 * the same dependency array so they fire together on every mount. There is no
 * double-fire risk from React StrictMode double-invocation in tests because:
 *  - `trackEvent` is a no-op when `window.posthog` is absent (dev/test).
 *  - `sendViewBeacon` is a no-op when `navigator` is undefined (SSR/test).
 *  In production builds StrictMode is disabled, so the effect runs once only.
 */
export function AccommodationViewTracker({
    slug,
    accommodationId,
    locale
}: AccommodationViewTrackerProps): null {
    useEffect(() => {
        // PostHog event — unchanged from SPEC-140 (additive only).
        trackEvent(WebEvents.AccommodationViewed, {
            slug,
            accommodation_id: accommodationId,
            locale
        });

        // View beacon to the server-side view capture endpoint (SPEC-159).
        sendViewBeacon({ entityType: EntityTypeEnum.ACCOMMODATION, entityId: accommodationId });
    }, [slug, accommodationId, locale]);

    return null;
}
