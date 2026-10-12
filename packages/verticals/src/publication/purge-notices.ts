import type { PublicationVertical } from './publication-types';

/** Outbox template for the owner's listing purge confirmation. */
export const LISTING_PURGED_TEMPLATE = 'verticals.listing-purged';
/** Outbox template for a tourist whose price alert was closed by a purge. */
export const PRICE_ALERT_CLOSED_TEMPLATE = 'verticals.price-alert-closed';

/** Builds data-only payload for the owner confirmation. */
export function buildListingPurgedPayload(args: {
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly listingName?: string;
    readonly bySupport: boolean;
}): Readonly<Record<string, unknown>> {
    return args;
}

/** Builds data-only payload for a closed tourist alert. */
export function buildPriceAlertClosedPayload(args: {
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly alertId: string;
}): Readonly<Record<string, unknown>> {
    return args;
}
