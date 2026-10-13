/**
 * @module services/conversation/listing-availability
 *
 * Whether the listing a conversation is about still admits new messages from
 * the viewer of the thread (HOS-1492, V8a rows 28 and 35). Pure: it reads the
 * listing row the caller already loaded and evaluates nothing from `@repo/db`.
 */

import { type ConversationListingAvailability, PublicationStatusEnum } from '@repo/schemas';
import { readListingAccessFacts, resolveResourceStep } from '@repo/verticals';

/** The side of the thread that is reading it. */
export type ConversationViewer = 'OWNER' | 'GUEST';

/**
 * Resolve the listing availability shown on a conversation thread.
 *
 * - `GONE` for both sides when the listing reached `PURGED` (row 28).
 * - For the `GUEST` side, `NOT_PUBLISHED` when `WRITE_ABOUT_LISTING` is not
 *   allowed: the same question `MessageService.createMessage` asks before
 *   accepting a guest message (row 35). It never says why.
 * - `AVAILABLE` otherwise. The owner keeps writing about a draft, archived,
 *   moderated or billing-unpublished listing.
 *
 * @param input - `{ viewer, actorId, listing }`, where `listing` is the raw
 *   accommodation row (or `null` when it could not be read).
 * @returns The availability literal.
 *
 * @example
 * ```ts
 * const availability = resolveConversationListingAvailability({
 *     viewer: 'GUEST',
 *     actorId: actor.id,
 *     listing: accommodation
 * });
 * ```
 */
export function resolveConversationListingAvailability(input: {
    readonly viewer: ConversationViewer;
    readonly actorId: string | null;
    readonly listing: unknown;
}): ConversationListingAvailability {
    const facts = readListingAccessFacts({ entity: input.listing });
    if (facts?.publicationStatus === PublicationStatusEnum.PURGED) {
        return 'GONE';
    }
    if (input.viewer === 'OWNER') {
        return 'AVAILABLE';
    }
    const step = resolveResourceStep({
        actorId: input.actorId,
        facts,
        operation: 'WRITE_ABOUT_LISTING'
    });
    return step.allowed ? 'AVAILABLE' : 'NOT_PUBLISHED';
}
