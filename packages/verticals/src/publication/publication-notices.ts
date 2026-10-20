import type { PublicationVertical } from './publication-types';

/** Email outbox template for PB3/PB7 restitution. */
export const LISTING_RESTITUTION_TEMPLATE = 'verticals.listing-restitution';

/** Identifies the listings restored and the candidates that remained over quota. */
export interface ListingRestitutionPayload {
    readonly vertical: PublicationVertical;
    readonly restoredListingIds: readonly string[];
    readonly notRestoredListingIds: readonly string[];
    readonly criterion: 'LAST_FELL_FIRST_BACK';
}

/** Builds the stable notice payload for one restitution transition. */
export function buildRestitutionPayload(args: {
    readonly vertical: PublicationVertical;
    readonly restoredListingIds: readonly string[];
    readonly notRestoredListingIds: readonly string[];
}): ListingRestitutionPayload {
    return {
        vertical: args.vertical,
        restoredListingIds: [...args.restoredListingIds],
        notRestoredListingIds: [...args.notRestoredListingIds],
        criterion: 'LAST_FELL_FIRST_BACK'
    };
}
