import type { ListingPurgedAddonCanceller } from '../reconciliation/sweep/zero-call-ports';
import { type CancelPurgedListingAddonPorts, cancelPurgedListingAddon } from './addon-instance-a6';

/** Register the real A6 act behind B5's fourth zero-call check. */
export function createListingPurgedAddonCanceller(
    ports: CancelPurgedListingAddonPorts
): ListingPurgedAddonCanceller {
    return {
        async cancelPurgedListingAddon(input) {
            await cancelPurgedListingAddon(input, ports);
        }
    };
}
