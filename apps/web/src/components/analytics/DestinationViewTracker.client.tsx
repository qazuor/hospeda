/**
 * @file DestinationViewTracker.client.tsx
 * @description Headless tracker for destination detail views.
 */

import { useEffect } from 'react';
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/posthog-client';
import type { SupportedLocale } from '@/lib/i18n';

interface DestinationViewTrackerProps {
    readonly destinationId: string;
    readonly destinationSlug: string;
    readonly locale: SupportedLocale;
}

export function DestinationViewTracker({
    destinationId,
    destinationSlug,
    locale
}: DestinationViewTrackerProps): null {
    useEffect(() => {
        trackEvent(WebEvents.DestinationViewed, {
            destination_id: destinationId,
            destination_slug: destinationSlug,
            locale,
            source_page: 'destination_detail'
        });
    }, [destinationId, destinationSlug, locale]);

    return null;
}
