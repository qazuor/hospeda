import type { Clock } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum } from '@repo/schemas';
import { withPublicationLock } from './publication-lock';
import type {
    PublicationAfterCommit,
    PublicationUnitOfWork,
    PublicationVertical
} from './publication-types';

/** PB8 outcomes for an owner reactivating an archived listing. */
export type ReactivateListingResult =
    | {
          readonly reactivated: false;
          readonly reason: 'LISTING_NOT_FOUND' | 'NOT_OWNER' | 'INVALID_FROM';
      }
    | { readonly reactivated: true };

/** Returns any archived listing to DRAFT and restarts its inactivity clock. */
export async function reactivateListing(args: {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly clock: Clock;
    readonly afterCommit: PublicationAfterCommit;
    readonly userId: string;
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly correlationId: string;
}): Promise<ReactivateListingResult> {
    return withPublicationLock({
        unitOfWork: args.unitOfWork,
        userId: args.userId,
        vertical: args.vertical,
        work: async (tx) => {
            const listing = await tx.readListing({
                vertical: args.vertical,
                listingId: args.listingId
            });
            if (!listing) return { reactivated: false, reason: 'LISTING_NOT_FOUND' };
            if (listing.ownerId !== args.userId) return { reactivated: false, reason: 'NOT_OWNER' };
            if (listing.publicationStatus !== PublicationStatusEnum.ARCHIVED)
                return { reactivated: false, reason: 'INVALID_FROM' };
            const at = args.clock.now();
            const changed = await tx.setPublicationStatus({
                vertical: args.vertical,
                listingId: listing.id,
                from: PublicationStatusEnum.ARCHIVED,
                to: PublicationStatusEnum.DRAFT,
                inactiveSince: at,
                actorId: args.userId
            });
            if (!changed) return { reactivated: false, reason: 'INVALID_FROM' };
            await tx.insertStatusChangedEvent({
                vertical: args.vertical,
                listingId: listing.id,
                from: PublicationStatusEnum.ARCHIVED,
                to: PublicationStatusEnum.DRAFT,
                oldInactiveSince: listing.inactiveSince,
                inactiveSince: at,
                actorType: 'owner',
                actorId: args.userId,
                correlationId: args.correlationId
            });
            return { reactivated: true };
        }
    });
}
