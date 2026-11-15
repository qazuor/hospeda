import { VerticalEnum } from '@repo/schemas';
import { syncListingFeatured } from '../../../../../packages/verticals/src/featured/sync-listing-featured';
import type { PublicationVertical } from '../../../../../packages/verticals/src/publication/publication-types';
import { getListingAccessPorts } from '../listing-access/ports';
import { apiLogger } from '../logger';
import { getListingFeaturedPorts } from './listing-featured-ports';

let unsubscribe: (() => void) | undefined;
const inFlightSyncs = new Set<Promise<void>>();

function isPublicationVertical(vertical: string): vertical is PublicationVertical {
    return (
        vertical === VerticalEnum.ACCOMMODATION ||
        vertical === VerticalEnum.VENUE ||
        vertical === VerticalEnum.EXPERIENCE
    );
}

/** Waits until all currently running listing featured synchronizations finish. */
export async function drainListingFeaturedSyncs(): Promise<void> {
    while (inFlightSyncs.size > 0) await Promise.allSettled([...inFlightSyncs]);
}

/** Subscribes once to coverage changes and returns a closure that removes the listener. */
export function subscribeListingFeaturedSync(): () => void {
    if (unsubscribe) return () => unsubscribe?.();
    unsubscribe = getListingAccessPorts().billing.onCoverageChanged((event) => {
        const vertical = event.vertical;
        if (!isPublicationVertical(vertical)) return;
        const sync = (async () => {
            try {
                await syncListingFeatured({
                    ports: getListingFeaturedPorts(),
                    userId: event.userId,
                    vertical
                });
            } catch (error) {
                apiLogger.error(
                    { error, userId: event.userId, vertical },
                    'Listing featured sync failed'
                );
            }
        })();
        inFlightSyncs.add(sync);
        void sync.finally(() => inFlightSyncs.delete(sync));
    });
    return () => {
        unsubscribe?.();
        unsubscribe = undefined;
    };
}
