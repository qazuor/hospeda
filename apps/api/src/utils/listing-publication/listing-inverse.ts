/**
 * The listing entries of the contract's inverse direction as composed by
 * `apps/api` (contract §4.1, §3.1; AC:V6:26, HOS-1483): `ficha` (`listing`)
 * and `fichaPurgada` (`listingPurged`) from `@repo/verticals` over
 * `@repo/db`'s `listingContractModel`, and the PB12 push `onListingPurged`
 * from the in-process emitter that PB12 fires after its commit.
 */

import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import { listingContractModel } from '@repo/db';
import { createListingInverse } from '@repo/verticals';
import { onListingPurged } from './listing-purged-emitter';

/**
 * Builds the production listing entries of the inverse contract.
 *
 * The reader resolves `listingContractModel` on EVERY call, never when the
 * entries are built: nothing from `@repo/db` is evaluated at construction, so
 * callers that build ports early (and tests that mock `@repo/db` whole) do not
 * touch the database or an undefined export.
 *
 * @returns `listing`, `listingPurged` and `onListingPurged`
 */
export function createApiListingInverse(): Pick<
    VerticalsForBilling,
    'listing' | 'listingPurged' | 'onListingPurged'
> {
    const inverse = createListingInverse({
        reader: {
            findListingsById: (args) =>
                listingContractModel.findListingsById({ listingId: args.listingId })
        }
    });
    return {
        listing: inverse.listing,
        listingPurged: inverse.listingPurged,
        onListingPurged
    };
}
