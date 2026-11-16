/**
 * @file InternalEntryTracker.client.tsx
 * @description Headless island for the listing detail pages (HOS-2119 T-076).
 * When the visitor arrives from another page of this same site, it sends the
 * `listing_internal_entry` catalog event once per page load, tagged with the
 * entity id, so the owner stats can split "Desde Hospeda" from "Directo".
 *
 * - Same-origin is decided by comparing parsed URL origins, never by string
 *   prefix (`https://site.com.evil.com` must not pass).
 * - The Umami tracker script is `defer`, so it may not exist yet at hydration.
 *   The island polls briefly (bounded) and gives up silently.
 * - Receives only the entity id, type and locale: no per-user data, so the
 *   page stays session-blind.
 *
 * Mount with `client:idle`: the event is not needed before first paint and the
 * bounded wait covers the deferred tracker.
 */

import { AnalyticsEvents } from '@repo/analytics';
import { useEffect, useRef } from 'react';
import { trackTaggedEvent } from '@/lib/analytics/umami-client';
import type { SupportedLocale } from '@/lib/i18n';

/** Interval between checks for `window.umami`. */
const POLL_INTERVAL_MS = 250;
/** Maximum number of checks (about 5 seconds in total). */
const MAX_POLL_ATTEMPTS = 20;

/** Listing types that have an owner traffic page. */
export type InternalEntryEntityType = 'ACCOMMODATION' | 'VENUE' | 'EXPERIENCE' | 'PARTNER';

/** Props for {@link InternalEntryTracker}. */
export interface InternalEntryTrackerProps {
    /** Listing type of the page. */
    readonly entityType: InternalEntryEntityType;
    /** UUID of the listing; also used as the Umami tag. */
    readonly entityId: string;
    /** Active locale. */
    readonly locale: SupportedLocale;
}

/**
 * Whether `referrer` is a non-empty URL whose origin equals `currentOrigin`.
 *
 * @param input - Referrer string and the current page origin.
 * @returns `true` only for a parseable same-origin referrer.
 */
export function isSameOriginReferrer({
    referrer,
    currentOrigin
}: {
    readonly referrer: string;
    readonly currentOrigin: string;
}): boolean {
    if (referrer === '') return false;
    try {
        return new URL(referrer).origin === currentOrigin;
    } catch {
        return false;
    }
}

function isTrackerReady(): boolean {
    // TYPE-WORKAROUND: the Umami script attaches window.umami at runtime and no global typing is declared for it.
    return typeof (window as unknown as { umami?: unknown }).umami !== 'undefined';
}

/**
 * Sends `listing_internal_entry` once per mount when the referrer is
 * same-origin. Renders nothing.
 */
export function InternalEntryTracker({
    entityType,
    entityId,
    locale
}: InternalEntryTrackerProps): null {
    const sentRef = useRef(false);

    useEffect(() => {
        if (sentRef.current) return;
        if (
            !isSameOriginReferrer({
                referrer: document.referrer,
                currentOrigin: window.location.origin
            })
        ) {
            return;
        }

        const send = (): void => {
            sentRef.current = true;
            trackTaggedEvent({
                name: AnalyticsEvents.listingInternalEntry,
                properties: { entity_id: entityId, entity_type: entityType, locale },
                tag: entityId
            });
        };

        if (isTrackerReady()) {
            send();
            return;
        }

        let attempts = 0;
        const timer = window.setInterval(() => {
            attempts += 1;
            if (isTrackerReady()) {
                window.clearInterval(timer);
                send();
            } else if (attempts >= MAX_POLL_ATTEMPTS) {
                window.clearInterval(timer);
            }
        }, POLL_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [entityType, entityId, locale]);

    return null;
}
