import { PublicationStatusEnum } from '@repo/schemas';

/** A listing's stable place in the publication and return queues. */
export interface PublicationQueueEntry {
    readonly id: string;
    readonly createdAt: Date;
    /** Null marks a listing present at the data cut, without a PB1 event. */
    readonly publishedAt: Date | null;
}

/** Compares publication history, then creation time, then stable identifier. */
export function comparePublicationOrder(
    a: PublicationQueueEntry,
    b: PublicationQueueEntry
): number {
    if (a.publishedAt === null && b.publishedAt !== null) return -1;
    if (a.publishedAt !== null && b.publishedAt === null) return 1;
    if (a.publishedAt && b.publishedAt) {
        const byPublished = a.publishedAt.getTime() - b.publishedAt.getTime();
        if (byPublished !== 0) return byPublished;
    }
    const byCreated = a.createdAt.getTime() - b.createdAt.getTime();
    if (byCreated !== 0) return byCreated;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Orders listings that regain a publication slot when coverage returns, newest
 * manual publish first (HOS-1984). With the cap full, the listings the host
 * published by hand most recently stay visible. A listing with no manual
 * publish instant (present at the data cut) ranks last; ties fall back to
 * newest creation, then identifier.
 */
export function orderRestorationCandidates(args: {
    readonly entries: readonly PublicationQueueEntry[];
}): readonly PublicationQueueEntry[] {
    return [...args.entries].sort((a, b) => {
        if (a.publishedAt === null && b.publishedAt !== null) return 1;
        if (a.publishedAt !== null && b.publishedAt === null) return -1;
        if (a.publishedAt && b.publishedAt) {
            const byPublished = b.publishedAt.getTime() - a.publishedAt.getTime();
            if (byPublished !== 0) return byPublished;
        }
        const byCreated = b.createdAt.getTime() - a.createdAt.getTime();
        if (byCreated !== 0) return byCreated;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

/** Selects the most recent published listings to lower, newest first. */
export function selectSurplusToLower(args: {
    readonly published: readonly PublicationQueueEntry[];
    readonly limit: number;
    readonly keep?: ReadonlySet<string>;
}): readonly PublicationQueueEntry[] {
    const excess = args.published.length - args.limit;
    if (excess <= 0) return [];
    const ordered = [...args.published].sort(comparePublicationOrder);
    if (args.keep?.size) {
        const selected = ordered.filter((entry) => args.keep?.has(entry.id));
        const unselected = ordered.filter((entry) => !args.keep?.has(entry.id));
        ordered.splice(0, ordered.length, ...selected, ...unselected);
    }
    return ordered.slice(-excess).reverse();
}

/**
 * `PB4` vs `PB5`: a listing archived from `PUBLISHED` or `UNPUBLISHED_BY_BILLING` may
 * come back on its own when coverage returns (`PB7`); one archived from any other
 * origin — a draft (`PB5`), or with no recorded origin — never does.
 *
 * @param input.origin - The origin of the listing's latest transition into `ARCHIVED`
 * @returns Whether `PB7` may restore it
 */
export function isRestorableArchiveOrigin(input: {
    readonly origin: PublicationStatusEnum | null | undefined;
}): boolean {
    return (
        input.origin === PublicationStatusEnum.PUBLISHED ||
        input.origin === PublicationStatusEnum.UNPUBLISHED_BY_BILLING
    );
}

/**
 * Splits the listings that may return when coverage comes back into the ones that
 * regain a slot and the ones the quota leaves out, in {@link orderRestorationCandidates}
 * order. A null `available` means the declared limit is absent, and then nothing
 * returns — the same rule `recalculateCoverage` applies.
 *
 * @param input.entries - Eligible candidates (complete, restorable)
 * @param input.available - Free publication slots, or null when no limit is declared
 * @returns The restoring and the left-out entries
 */
export function planRestoration(input: {
    readonly entries: readonly PublicationQueueEntry[];
    readonly available: number | null;
}): {
    readonly restoring: readonly PublicationQueueEntry[];
    readonly withoutSlot: readonly PublicationQueueEntry[];
} {
    const ordered = orderRestorationCandidates({ entries: input.entries });
    const slots = input.available === null ? 0 : Math.max(0, input.available);
    return { restoring: ordered.slice(0, slots), withoutSlot: ordered.slice(slots) };
}
