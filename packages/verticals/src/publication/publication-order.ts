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

/** Where a listing sits for the HOS-1810 one-address rule. */
export interface RestorationPlace {
    /** The normalized place key, or null (a null key never collides). */
    readonly key: string | null;
    /** An exception granted for the CURRENT key exempts the listing from the rule. */
    readonly exempt: boolean;
}

/**
 * Previews the reconciler's restore loop (`recalculateCoverage`, PB7) without writing: in
 * {@link orderRestorationCandidates} order, each candidate takes a free slot unless the
 * HOS-1810 one-address rule would make its status write answer "not changed" — then it
 * keeps no slot and the next candidate is tried, exactly as the loop does. A null
 * `available` means the declared limit is absent, and then nothing returns. Read-only and
 * for previews only: the reconciler keeps its own effectful loop, because only the write
 * knows the outcome for sure.
 *
 * @param input.entries - Eligible candidates (complete, restorable)
 * @param input.available - Free publication slots, or null when no limit is declared
 * @param input.places - Place of each listing (candidates and published ones), if known
 * @param input.publishedIds - Listings that stay PUBLISHED while the loop runs
 * @returns The restoring, the location-blocked and the left-out entries
 */
export function planRestoration(input: {
    readonly entries: readonly PublicationQueueEntry[];
    readonly available: number | null;
    readonly places?: ReadonlyMap<string, RestorationPlace>;
    readonly publishedIds?: readonly string[];
}): {
    readonly restoring: readonly PublicationQueueEntry[];
    readonly locationConflict: readonly PublicationQueueEntry[];
    readonly withoutSlot: readonly PublicationQueueEntry[];
} {
    const ordered = orderRestorationCandidates({ entries: input.entries });
    let slots = input.available === null ? 0 : Math.max(0, input.available);
    const taken = new Set<string>();
    const occupy = (id: string) => {
        const place = input.places?.get(id);
        if (place?.key && !place.exempt) taken.add(place.key);
    };
    for (const id of input.publishedIds ?? []) occupy(id);
    const restoring: PublicationQueueEntry[] = [];
    const locationConflict: PublicationQueueEntry[] = [];
    const withoutSlot: PublicationQueueEntry[] = [];
    for (const candidate of ordered) {
        if (slots <= 0) {
            withoutSlot.push(candidate);
            continue;
        }
        const place = input.places?.get(candidate.id);
        if (place?.key && !place.exempt && taken.has(place.key)) {
            locationConflict.push(candidate);
            continue;
        }
        restoring.push(candidate);
        occupy(candidate.id);
        slots -= 1;
    }
    return { restoring, locationConflict, withoutSlot };
}
