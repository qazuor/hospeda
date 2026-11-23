/**
 * @file owner-listing-primary-action.ts
 * @description Which ONE action a venue/experience listing card shows as its
 * primary action (HOS-2484, AC-7 «one primary action per card»).
 *
 * A card offers publishing only in the states `ListingActions` renders the
 * publish button for: a complete draft whose affordance allows publishing, or a
 * listing the system took down that may be republished. That button is then
 * the primary action and «Editar» moves to the card's menu; in every other
 * live state «Editar» is the primary action. A purged listing offers nothing
 * (HOS-1641).
 *
 * It reads the same deciders the island uses (`resolveListingCardState`,
 * `resolvePropertyCardActions`, `resolveRepublishOffer`), so the page and the
 * island cannot disagree about whether the publish button exists.
 */

import { PublicationStatusEnum } from '@repo/schemas';
import {
    resolvePropertyCardActions,
    resolveRepublishOffer
} from '@/lib/host/property-card-actions';
import type { PublishAffordance } from '@/lib/publish/subscribe-button';
import { resolveListingCardState } from './listing-card-state';
import type { OwnerListingSummaryWithState } from './owner-listings';

/** The primary action of a listing card. */
export type OwnerListingPrimaryAction = 'publish' | 'edit' | 'none';

/**
 * Resolves the card's primary action.
 *
 * @param input.listing - The listing summary with its completeness preview.
 * @param input.affordance - The server-derived publish affordance of its vertical.
 * @returns `'publish'`, `'edit'` or `'none'` (purged).
 */
export function resolveOwnerListingPrimaryAction({
    listing,
    affordance
}: {
    readonly listing: OwnerListingSummaryWithState;
    readonly affordance: PublishAffordance;
}): OwnerListingPrimaryAction {
    if (listing.publicationStatus === PublicationStatusEnum.PURGED) return 'none';
    const state = resolveListingCardState({
        publicationStatus: listing.publicationStatus,
        isPublic: listing.isPublic,
        completeness: listing.completeness
    });
    if (state.kind === 'published') return 'edit';
    const actions = resolvePropertyCardActions({ publicationStatus: listing.publicationStatus });
    const offersPublish =
        (state.kind === 'draft-complete' && actions.publish) ||
        resolveRepublishOffer({ actions, affordance });
    return offersPublish ? 'publish' : 'edit';
}
