import type { PublicationQueueEntry } from './publication-order';
import { orderReturningCandidates } from './publication-order';

/** Chooses the returning listing and any published listings displaced by quota. */
export function selectPublishedWithinQuota(args: {
    readonly published: readonly PublicationQueueEntry[];
    readonly returning: PublicationQueueEntry;
    readonly limit: number;
}): { readonly publishReturning: boolean; readonly lower: readonly PublicationQueueEntry[] } {
    if (args.limit <= 0) return { publishReturning: false, lower: [] };
    const candidates = orderReturningCandidates({ entries: [...args.published, args.returning] });
    const selected = candidates.slice(0, args.limit);
    const selectedIds = new Set(selected.map(({ id }) => id));
    return {
        publishReturning: selectedIds.has(args.returning.id),
        lower: args.published.filter(({ id }) => !selectedIds.has(id))
    };
}
