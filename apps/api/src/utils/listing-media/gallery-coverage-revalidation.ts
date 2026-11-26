/**
 * Purges the public cache of an owner's listings when their coverage changes
 * (HOS-2495 AC-18).
 *
 * The public gallery is trimmed to the owner's effective photo cap at read
 * time, so a pack bought, a plan lost or a grant revoked changes what every
 * published listing of that owner shows. This listener evicts those responses
 * from the API memory cache and schedules the edge revalidation. It first
 * invalidates the owner's effective-set snapshots, so the purge cannot be
 * refilled from a stale snapshot: the generic invalidation listener is
 * registered later and listener order is not a contract.
 *
 * Delivery is in-process with no durable retry; the daily coverage reconciler
 * and the edge TTL are the backstop. A failure is logged, never thrown into
 * the emitter.
 *
 * @module utils/listing-media/gallery-coverage-revalidation
 */
import { accommodations, and, eq, experiences, getDb, isNull, venues } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { invalidateEffectiveSetsForUser } from '../effective-set-cache';
import type { ListingPhotoVertical } from '../listing-access/photo-limit';
import { getListingAccessPorts } from '../listing-access/ports';
import { getListingPublicationPorts } from '../listing-publication/ports';
import { apiLogger } from '../logger';

/** What the revalidation needs from the outside world. */
export type GalleryRevalidationPorts = {
    readonly invalidateUser: (args: { readonly userId: string }) => Promise<void>;
    readonly listPublishedListingIds: (args: {
        readonly ownerId: string;
        readonly vertical: ListingPhotoVertical;
    }) => Promise<readonly string[]>;
    readonly revalidate: (args: {
        readonly vertical: ListingPhotoVertical;
        readonly listingIds: readonly string[];
    }) => Promise<void>;
};

let unsubscribe: (() => void) | undefined;
const inFlight = new Set<Promise<void>>();

function isListingVertical(vertical: string): vertical is ListingPhotoVertical {
    return (
        vertical === VerticalEnum.ACCOMMODATION ||
        vertical === VerticalEnum.VENUE ||
        vertical === VerticalEnum.EXPERIENCE
    );
}

/** The production ports: Redis snapshot invalidation, one id query, the publication purge. */
function productionPorts(): GalleryRevalidationPorts {
    return {
        invalidateUser: ({ userId }) => invalidateEffectiveSetsForUser(userId),
        async listPublishedListingIds({ ownerId, vertical }) {
            const table =
                vertical === VerticalEnum.VENUE
                    ? venues
                    : vertical === VerticalEnum.EXPERIENCE
                      ? experiences
                      : accommodations;
            const rows = await getDb()
                .select({ id: table.id })
                .from(table)
                .where(
                    and(
                        eq(table.ownerId, ownerId),
                        eq(table.publicationStatus, PublicationStatusEnum.PUBLISHED),
                        isNull(table.deletedAt)
                    )
                );
            return rows.map(({ id }) => id);
        },
        revalidate: (args) => getListingPublicationPorts().afterCommit.revalidate(args)
    };
}

/**
 * Invalidates the owner's snapshots, then purges every published listing of
 * the owner in that vertical. Never throws.
 *
 * @param input.userId - The owner whose coverage changed.
 * @param input.vertical - The listing vertical of the change.
 * @param input.ports - The ports to use (production by default).
 * @returns `{ revalidated }`, the listing ids handed to the purge (empty on failure).
 */
export async function revalidateOwnerListingGalleries({
    userId,
    vertical,
    ports = productionPorts()
}: {
    readonly userId: string;
    readonly vertical: ListingPhotoVertical;
    readonly ports?: GalleryRevalidationPorts;
}): Promise<{ readonly revalidated: readonly string[] }> {
    try {
        await ports.invalidateUser({ userId });
        const listingIds = await ports.listPublishedListingIds({ ownerId: userId, vertical });
        if (listingIds.length === 0) return { revalidated: [] };
        await ports.revalidate({ vertical, listingIds });
        return { revalidated: listingIds };
    } catch (error) {
        apiLogger.error(
            { error, userId, vertical },
            'Listing gallery revalidation after a coverage change failed'
        );
        return { revalidated: [] };
    }
}

/** Waits until every revalidation already started has finished. */
export async function drainListingGalleryRevalidations(): Promise<void> {
    while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
}

/**
 * Subscribes once to coverage changes of the listing verticals.
 *
 * @param input.ports - The ports to use (production by default; tests inject fakes).
 * @returns The closure that removes the listener.
 */
export function subscribeListingGalleryRevalidation({
    ports
}: {
    readonly ports?: GalleryRevalidationPorts;
} = {}): () => void {
    if (unsubscribe) return () => unsubscribe?.();
    unsubscribe = getListingAccessPorts().billing.onCoverageChanged((event) => {
        const vertical = event.vertical;
        if (!isListingVertical(vertical)) return;
        const run = (async () => {
            await revalidateOwnerListingGalleries({
                userId: event.userId,
                vertical,
                ...(ports ? { ports } : {})
            });
        })();
        inFlight.add(run);
        void run.finally(() => inFlight.delete(run));
    });
    return () => {
        unsubscribe?.();
        unsubscribe = undefined;
    };
}
