import type { PublicationStatusEnum } from '@repo/schemas';
import type { PublicationVertical } from './publication-types';

/** Outbox template for taking a listing down for moderation. */
export const LISTING_MODERATED_TEMPLATE = 'verticals.listing-moderated';
/** Outbox template for requesting a fix without taking a listing down. */
export const LISTING_FIX_REQUESTED_TEMPLATE = 'verticals.listing-fix-requested';
/** Outbox template for changing between moderation levels. */
export const LISTING_MODERATION_LEVEL_CHANGED_TEMPLATE =
    'verticals.listing-moderation-level-changed';
/** Outbox template for lifting moderation. */
export const LISTING_MODERATION_LIFTED_TEMPLATE = 'verticals.listing-moderation-lifted';

/** Data only; renderers and customer facing text belong to notifications. */
export interface ListingModerationNoticePayload {
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly reason: string;
    readonly suggestedDate?: string;
    readonly returnedTo?: PublicationStatusEnum;
    readonly fixRequestOpen: boolean;
}

/** Builds the payload shared by listing moderation notices. */
export function buildListingModerationNoticePayload(
    args: ListingModerationNoticePayload
): ListingModerationNoticePayload {
    return { ...args };
}
