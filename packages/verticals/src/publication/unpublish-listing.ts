import type { Clock } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum } from '@repo/schemas';
import { publicationAfterCommit, withPublicationLock } from './publication-lock';
import type {
    PostCommitWarning,
    PublicationAfterCommit,
    PublicationUnitOfWork,
    PublicationVertical
} from './publication-types';

/** PB6's normal outcomes. */
export type UnpublishListingResult =
    | {
          readonly unpublished: false;
          readonly reason: 'LISTING_NOT_FOUND' | 'NOT_OWNER' | 'INVALID_FROM';
      }
    | { readonly unpublished: true; readonly warnings: readonly PostCommitWarning[] };

/** Moves a published listing to DRAFT without changing or crediting its trial. */
export async function unpublishListing(args: {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly clock: Clock;
    readonly afterCommit: PublicationAfterCommit;
    readonly userId: string;
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly correlationId: string;
}): Promise<UnpublishListingResult> {
    const decision = await withPublicationLock({
        unitOfWork: args.unitOfWork,
        userId: args.userId,
        vertical: args.vertical,
        work: async (tx) => {
            const listing = await tx.readListing({
                vertical: args.vertical,
                listingId: args.listingId
            });
            if (!listing) return { unpublished: false, reason: 'LISTING_NOT_FOUND' } as const;
            if (listing.ownerId !== args.userId)
                return { unpublished: false, reason: 'NOT_OWNER' } as const;
            if (listing.publicationStatus !== PublicationStatusEnum.PUBLISHED)
                return { unpublished: false, reason: 'INVALID_FROM' } as const;
            const at = args.clock.now();
            const changed = await tx.setPublicationStatus({
                vertical: args.vertical,
                listingId: args.listingId,
                from: PublicationStatusEnum.PUBLISHED,
                to: PublicationStatusEnum.DRAFT,
                inactiveSince: at,
                actorId: args.userId
            });
            if (!changed) throw new Error('publication status changed inside locked transaction');
            await tx.insertStatusChangedEvent({
                vertical: args.vertical,
                listingId: args.listingId,
                from: PublicationStatusEnum.PUBLISHED,
                to: PublicationStatusEnum.DRAFT,
                oldInactiveSince: listing.inactiveSince,
                inactiveSince: at,
                actorType: 'owner',
                actorId: args.userId,
                correlationId: args.correlationId
            });
            return { unpublished: true } as const;
        }
    });
    if (!decision.unpublished) return decision;
    const warnings = await publicationAfterCommit({
        tasks: [
            {
                warning: 'REVALIDATION_FAILED',
                run: () =>
                    args.afterCommit.revalidate({
                        vertical: args.vertical,
                        listingIds: [args.listingId]
                    })
            }
        ]
    });
    return { ...decision, warnings };
}
