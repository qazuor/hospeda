import type { ListingPurgedEvent } from '@repo/billing-verticals-contract';
import { ListingPurgedEventSchema } from '@repo/billing-verticals-contract';
import { apiLogger } from '../logger';

const listeners = new Set<(event: ListingPurgedEvent) => void | Promise<void>>();

/** Registers an in-process listener for committed PB12 events. */
export function onListingPurged(
    listener: (event: ListingPurgedEvent) => void | Promise<void>
): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Validates and broadcasts a committed PB12 event to every registered listener. */
export async function emitListingPurged(event: ListingPurgedEvent): Promise<void> {
    const parsed = ListingPurgedEventSchema.parse(event);
    for (const listener of [...listeners]) {
        setTimeout(() => {
            Promise.resolve(listener(parsed)).catch((error: unknown) => {
                apiLogger.warn(
                    { error, listingId: parsed.listingId },
                    'Listing purged listener failed'
                );
            });
        }, 50);
    }
}
