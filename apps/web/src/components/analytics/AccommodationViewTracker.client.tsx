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
import type { SupportedLocale } from '@/lib/i18n';
import { useEffect } from 'react';

interface AccommodationViewTrackerProps {
    readonly slug: string;
    readonly accommodationId: string;
    readonly locale: SupportedLocale;
}

export function AccommodationViewTracker({
    slug,
    accommodationId,
    locale
}: AccommodationViewTrackerProps): null {
    useEffect(() => {
        trackEvent(WebEvents.AccommodationViewed, {
            slug,
            accommodation_id: accommodationId,
            locale
        });
    }, [slug, accommodationId, locale]);

    return null;
}
