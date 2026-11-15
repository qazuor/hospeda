import { subscribeListingPurgedAddons } from '@repo/service-core';
import { beforeCancelNotice } from '../../routes/billing-subscription/before-cancel-notice';
import { getClock } from '../clock';
import { getCoverageNotices } from '../listing-access/coverage-notices';
import { getPaymentProvider } from '../payment-provider';
import { createApiListingInverse } from './listing-inverse';

let unsubscribe: (() => void) | undefined;
const inFlight = new Set<Promise<void>>();

/** Wait for addon cancellations already accepted by the process listener. */
export async function drainListingPurgedAddonCancellations(): Promise<void> {
    while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
}

/** Register the committed listing purge push with billing once per API process. */
export function subscribeListingPurgedAddonCancellation(): () => void {
    if (unsubscribe) return () => unsubscribe?.();
    const inverse = createApiListingInverse();
    unsubscribe = subscribeListingPurgedAddons(
        {
            onListingPurged: (listener) =>
                inverse.onListingPurged((event) => {
                    const task = Promise.resolve().then(() => listener(event));
                    inFlight.add(task);
                    void task.finally(() => inFlight.delete(task));
                    return task;
                })
        },
        {
            listing: inverse.listing,
            listingPurged: inverse.listingPurged,
            provider: getPaymentProvider(),
            clock: getClock().clock,
            beforeCancelNotice,
            coverageNotices: getCoverageNotices()
        }
    );
    return () => {
        unsubscribe?.();
        unsubscribe = undefined;
    };
}
