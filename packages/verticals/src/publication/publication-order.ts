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

/** Orders listings that return to publication, oldest publication first. */
export function orderReturningCandidates(args: {
    readonly entries: readonly PublicationQueueEntry[];
}): readonly PublicationQueueEntry[] {
    return [...args.entries].sort(comparePublicationOrder);
}

/** Selects the most recent published listings to lower, newest first. */
export function selectSurplusToLower(args: {
    readonly published: readonly PublicationQueueEntry[];
    readonly limit: number;
}): readonly PublicationQueueEntry[] {
    const excess = args.published.length - args.limit;
    if (excess <= 0) return [];
    return [...args.published].sort(comparePublicationOrder).slice(-excess).reverse();
}
