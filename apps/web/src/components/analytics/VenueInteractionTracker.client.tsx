/**
 * @file VenueInteractionTracker.client.tsx
 * @description Headless React island that records what a visitor taps on a
 * venue page (HOS-2256).
 *
 * Renders nothing. Mounted with `client:idle` next to `EntityViewTracker`.
 * It registers ONE delegated listener for `click` and `auxclick` (middle
 * button) on `document`, walks up from the event target to the nearest element
 * carrying `data-interaction-kind`, and sends the beacon. The `.astro`
 * components only carry the attributes, so they stay static and cacheable and
 * the page stays session-blind (the island is outside that guard's sweep).
 *
 * Never calls `preventDefault`: the navigation must not be delayed to record
 * telemetry. The listener is removed on unmount, because View Transitions
 * remount the island on every navigation.
 *
 * Known limit (documented in the panel of HOS-2261): copying a phone number
 * without tapping it, or opening a link from the context menu, does not count.
 */

import { EntityInteractionKindEnum } from '@repo/schemas';
import { useEffect } from 'react';
import { sendInteractionBeacon } from '@/lib/analytics/interaction-capture';

/** Attribute that marks an element as a tracked interaction and names its kind. */
export const INTERACTION_KIND_ATTRIBUTE = 'data-interaction-kind';
/** Attribute carrying the venue event id of an event interaction. */
export const INTERACTION_EVENT_ID_ATTRIBUTE = 'data-interaction-event-id';

const KINDS: ReadonlySet<string> = new Set(Object.values(EntityInteractionKindEnum));

/** Props for {@link VenueInteractionTracker}. */
interface VenueInteractionTrackerProps {
    /** UUID of the venue the page belongs to. */
    readonly entityId: string;
}

/**
 * Headless island that turns taps on `[data-interaction-kind]` elements into
 * interaction beacons.
 *
 * @param props - The venue id (RO-RO).
 * @returns `null`; no DOM output.
 */
export function VenueInteractionTracker({ entityId }: VenueInteractionTrackerProps): null {
    useEffect(() => {
        const handle = (event: MouseEvent): void => {
            // `auxclick` fires for every non-primary button; only the middle one
            // (open in a new tab) expresses the same intent as a tap.
            if (event.type === 'auxclick' && event.button !== 1) return;
            const target = event.target;
            if (!(target instanceof Element)) return;
            const element = target.closest(`[${INTERACTION_KIND_ATTRIBUTE}]`);
            if (!element) return;
            const kind = element.getAttribute(INTERACTION_KIND_ATTRIBUTE);
            if (!kind || !KINDS.has(kind)) return;
            const eventId = element.getAttribute(INTERACTION_EVENT_ID_ATTRIBUTE) ?? undefined;
            sendInteractionBeacon({
                entityId,
                kind: kind as EntityInteractionKindEnum,
                eventId
            });
        };
        document.addEventListener('click', handle);
        document.addEventListener('auxclick', handle);
        return () => {
            document.removeEventListener('click', handle);
            document.removeEventListener('auxclick', handle);
        };
    }, [entityId]);

    return null;
}
