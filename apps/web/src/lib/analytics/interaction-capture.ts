/**
 * @file interaction-capture.ts
 * @description Fire-and-forget beacon for listing interactions (HOS-2256).
 *
 * Sends `POST /api/v1/public/interactions` when a visitor taps a tracked
 * element of a venue page (phone, map, website, Instagram, ticket, WhatsApp).
 * It reuses the transport of `view-capture.ts` (`sendBeacon`, then
 * `fetch(keepalive)`, never throws, no-op during SSR), because those are
 * properties of the transport and not of the caller.
 *
 * The caller must NOT `preventDefault` to "make room" for the request: the
 * tapped link navigates in the same tick and `sendBeacon` is precisely the API
 * that survives it.
 */

import type { EntityInteractionKind } from '@repo/schemas';
import { postBeacon } from '@/lib/analytics/view-capture';

/** Input shape for {@link sendInteractionBeacon}. */
export interface SendInteractionBeaconInput {
    /** UUID of the venue the visitor is on. */
    readonly entityId: string;
    /** What the visitor did. */
    readonly kind: EntityInteractionKind;
    /** UUID of the venue event, for `TICKET_CLICK` and `EVENT_IMPRESSION` only. */
    readonly eventId?: string | undefined;
}

/**
 * Send one interaction to `POST /api/v1/public/interactions`. Never throws.
 *
 * @param input - Venue id, interaction kind and, for event kinds, the event id.
 */
export function sendInteractionBeacon({
    entityId,
    kind,
    eventId
}: SendInteractionBeaconInput): void {
    postBeacon({
        path: '/api/v1/public/interactions',
        payload: JSON.stringify({
            entityType: 'VENUE',
            entityId,
            kind,
            ...(eventId ? { eventId } : {})
        }),
        label: 'interaction-capture'
    });
}
