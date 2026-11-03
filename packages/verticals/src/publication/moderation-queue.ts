import type { PublicationQueueEntry } from './publication-order';
import { orderRestorationCandidates } from './publication-order';

/**
 * Chooses the returning listing and any published listings displaced by quota.
 * Newest manual publish wins (see `orderRestorationCandidates`).
 */
export function selectPublishedWithinQuota(args: {
    readonly published: readonly PublicationQueueEntry[];
    readonly returning: PublicationQueueEntry;
    readonly limit: number;
}): { readonly publishReturning: boolean; readonly lower: readonly PublicationQueueEntry[] } {
    if (args.limit <= 0) return { publishReturning: false, lower: [] };
    // HOS-1997: same ORDER as the coverage restore path (HOS-1984): the listings the host
    // published by hand most recently win the slots; a listing with no publish instant ranks last.
    // Not the same operation: restore only fills free slots, while a lift can also lower
    // already-published listings that lose to the returning one.
    const candidates = orderRestorationCandidates({ entries: [...args.published, args.returning] });
    const selected = candidates.slice(0, args.limit);
    const selectedIds = new Set(selected.map(({ id }) => id));
    return {
        publishReturning: selectedIds.has(args.returning.id),
        lower: args.published.filter(({ id }) => !selectedIds.has(id))
    };
}
