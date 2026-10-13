import type { Clock } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum } from '@repo/schemas';
import { buildListingArchivedPayload, LISTING_ARCHIVED_TEMPLATE } from './archive-notices';
import { publicationAfterCommit, withPublicationLock } from './publication-lock';
import type {
    PostCommitWarning,
    PublicationAfterCommit,
    PublicationUnitOfWork,
    PublicationVertical,
    RetentionBilling
} from './publication-types';
import { announcedDeletionAt, archiveDueAt, retentionClockStart } from './retention-clock';

/** Result of one PB4/PB5 attempt. */
export type ArchiveInactiveListingResult =
    | {
          readonly archived: false;
          readonly reason:
              | 'LISTING_NOT_FOUND'
              | 'STATE_CHANGED'
              | 'RETENTION_STOPPED'
              | 'COVERED'
              | 'NOT_DUE';
      }
    | {
          readonly archived: true;
          readonly transition: 'PB4' | 'PB5';
          readonly deletionAnnouncedAt: Date;
          readonly warnings: readonly PostCommitWarning[];
      };

/** Archives an inactive listing under the shared user and vertical lock. */
export async function archiveInactiveListing(args: {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly billing: RetentionBilling;
    readonly clock: Clock;
    readonly afterCommit: PublicationAfterCommit;
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly ownerId: string;
    readonly correlationId: string;
}): Promise<ArchiveInactiveListingResult> {
    const decision = await withPublicationLock({
        unitOfWork: args.unitOfWork,
        userId: args.ownerId,
        vertical: args.vertical,
        work: async (tx) => {
            const listing = await tx.readRetentionListing({
                vertical: args.vertical,
                listingId: args.listingId
            });
            if (!listing) return { archived: false, reason: 'LISTING_NOT_FOUND' } as const;
            if (listing.ownerId !== args.ownerId)
                return { archived: false, reason: 'STATE_CHANGED' } as const;
            let transition: 'PB4' | 'PB5' | null;
            switch (listing.publicationStatus) {
                case PublicationStatusEnum.PUBLISHED:
                case PublicationStatusEnum.UNPUBLISHED_BY_BILLING:
                    transition = 'PB4';
                    break;
                case PublicationStatusEnum.DRAFT:
                    transition = 'PB5';
                    break;
                case PublicationStatusEnum.ARCHIVED:
                case PublicationStatusEnum.MODERATED:
                case PublicationStatusEnum.PURGED:
                    transition = null;
                    break;
            }
            if (!transition) return { archived: false, reason: 'STATE_CHANGED' } as const;
            const pause = await args.billing.retentionStopped({
                userId: args.ownerId,
                vertical: args.vertical
            });
            if (pause.stopped) return { archived: false, reason: 'RETENTION_STOPPED' } as const;
            const coverage = await args.billing.coverage({
                userId: args.ownerId,
                vertical: args.vertical
            });
            if (coverage.covered) {
                await tx.stampInactiveSince({
                    vertical: args.vertical,
                    listingIds: [listing.id],
                    at: args.clock.now()
                });
                return { archived: false, reason: 'COVERED' } as const;
            }
            const clockStart = retentionClockStart({
                inactiveSince: listing.inactiveSince,
                pauseEndedAt: pause.pauseEndedAt
            });
            const dueAt = archiveDueAt({ transition, clockStart, deadlines: listing.deadlines });
            const archivedAt = args.clock.now();
            if (archivedAt < dueAt) return { archived: false, reason: 'NOT_DUE' } as const;
            const deletionAnnouncedAt = announcedDeletionAt({
                archivedAt,
                dueAt,
                clockStart,
                deletionAfterDays: listing.deadlines.deletionAfterDays
            });
            const changed = await tx.setPublicationStatus({
                vertical: args.vertical,
                listingId: listing.id,
                from: listing.publicationStatus,
                to: PublicationStatusEnum.ARCHIVED,
                deletionAnnouncedAt
            });
            if (!changed) return { archived: false, reason: 'STATE_CHANGED' } as const;
            await tx.insertStatusChangedEvent({
                vertical: args.vertical,
                listingId: listing.id,
                from: listing.publicationStatus,
                to: PublicationStatusEnum.ARCHIVED,
                actorType: 'job',
                correlationId: args.correlationId,
                deletionAnnouncedAt,
                oldDeletionAnnouncedAt: listing.deletionAnnouncedAt
            });
            // AC:V6:28: the on-archive notice rides the same transaction as the transition.
            const listingAddonCount = coverage.sources.filter(
                (source) =>
                    source.type === 'ADDON' &&
                    source.scope === 'LISTING' &&
                    source.target === listing.id
            ).length;
            await tx.enqueueListingNotice({
                template: LISTING_ARCHIVED_TEMPLATE,
                recipientUserId: args.ownerId,
                payload: buildListingArchivedPayload({
                    vertical: args.vertical,
                    listingId: listing.id,
                    transition,
                    deletionAnnouncedAt,
                    listingAddonCount
                }),
                correlationId: args.correlationId,
                occurrenceKey: `listing-archived:${listing.id}`
            });
            return {
                archived: true,
                transition,
                deletionAnnouncedAt,
                revalidate: listing.publicationStatus === PublicationStatusEnum.PUBLISHED
            } as const;
        }
    });
    if (!decision.archived) return decision;
    const warnings = decision.revalidate
        ? await publicationAfterCommit({
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
          })
        : [];
    return {
        archived: true,
        transition: decision.transition,
        deletionAnnouncedAt: decision.deletionAnnouncedAt,
        warnings
    };
}
