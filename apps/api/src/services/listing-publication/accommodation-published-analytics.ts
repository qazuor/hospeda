/**
 * @file accommodation-published-analytics.ts
 * @description The `accommodationPublished` analytics event an owner publish
 * of an accommodation emits (PB1). Shared by the protected publish route
 * (`routes/accommodation/protected/publish.ts`) and the assistant tool
 * `set_listing_publication` (HOS-2184 T-018), so both report the same event
 * with the same properties. Venues and experiences emit no such event today.
 */

import { AnalyticsEvents } from '@repo/analytics';
import { captureServerAnalyticsEvent } from '../../lib/posthog';

/** The accommodation row `ListingPublicationService.publish` returns, as read here. */
export interface PublishedAccommodationFacts {
    /** Accommodation id. */
    readonly id: string;
    /** Accommodation type; reported only when it is a string. */
    readonly type?: unknown;
    /** Destination id; reported only when it is a string. */
    readonly destinationId?: unknown;
    /** Owner id; reported only when it is a string. */
    readonly ownerId?: unknown;
}

/**
 * Emits `accommodationPublished` for a successful owner publish. Fire and
 * forget, like every server analytics capture.
 *
 * @param input - The publishing actor's id and the published accommodation
 *
 * @example
 * ```typescript
 * const data = await listingPublicationService.publish({ actor, id });
 * captureAccommodationPublished({ actorId: actor.id, accommodation: data });
 * ```
 */
export function captureAccommodationPublished(input: {
    readonly actorId: string;
    readonly accommodation: PublishedAccommodationFacts;
}): void {
    const { actorId, accommodation } = input;
    captureServerAnalyticsEvent({
        distinctId: actorId,
        name: AnalyticsEvents.accommodationPublished,
        properties: {
            accommodation_id: accommodation.id,
            accommodation_type:
                typeof accommodation.type === 'string' ? accommodation.type : undefined,
            destination_id:
                typeof accommodation.destinationId === 'string'
                    ? accommodation.destinationId
                    : undefined,
            owner_id: typeof accommodation.ownerId === 'string' ? accommodation.ownerId : undefined
        }
    });
}
