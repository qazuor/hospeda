/**
 * The row-26 read (ACC:15, HOS-1493, H13): the most recent support edits of a
 * listing, as its owner sees them in Mi Cuenta — when, and which parts.
 *
 * The source is the audit register service-core writes for action 15
 * (`listing.created` / `listing.edited` with `actor_type = 'admin'`). The read
 * returns neither the admin's identity nor the reason: those belong to the
 * register, not to the owner's notice.
 *
 * @module services/listing-publication/listing-support-edit
 */

import { domainEventModel } from '@repo/db';
import type { ListingSupportEditsResponse } from '@repo/schemas';
import { buildSupportEditParts } from '@repo/service-core';
import type { ListingVertical } from '@repo/verticals';

/** How many support edits the notice shows. */
export const SUPPORT_EDITS_SHOWN = 3;

/** The event types that action 15 writes on a listing (H7). */
const SUPPORT_EDIT_EVENT_TYPES: ReadonlySet<string> = new Set([
    'listing.created',
    'listing.edited'
]);

/**
 * Lists the most recent support edits of one listing, newest first.
 *
 * @param input.vertical - The listing's vertical (also its event entity type).
 * @param input.listingId - The listing id.
 * @returns `{ items }` with at most {@link SUPPORT_EDITS_SHOWN} entries.
 */
export async function listSupportEdits(input: {
    readonly vertical: ListingVertical;
    readonly listingId: string;
}): Promise<ListingSupportEditsResponse> {
    const events = await domainEventModel.findByEntity({
        entityType: input.vertical,
        entityId: input.listingId
    });
    const items = events
        .filter(
            (event) => event.actorType === 'admin' && SUPPORT_EDIT_EVENT_TYPES.has(event.eventType)
        )
        .slice(-SUPPORT_EDITS_SHOWN)
        .reverse()
        .map((event) => ({
            occurredAt: event.occurredAt.toISOString(),
            parts: [...buildSupportEditParts({ changes: event.changes }).parts]
        }));
    return { items };
}
