import type { Clock } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum as Status } from '@repo/schemas';
import { inactivityClockStart } from './inactivity-clock';
import { withPublicationLock } from './publication-lock';
import type {
    PublicationUnitOfWork,
    PublicationVertical,
    RetentionBilling
} from './publication-types';
import { purgeDueAt } from './purge-inactive-listing';
import { archiveDueAt, retentionClockStart } from './retention-clock';
import {
    buildListingRetentionBeforeArchivePayload,
    buildListingRetentionBeforeDeletionPayload,
    LISTING_RETENTION_BEFORE_ARCHIVE_TEMPLATE,
    LISTING_RETENTION_BEFORE_DELETION_TEMPLATE,
    RETENTION_NOTICE_MILESTONES,
    retentionNoticeAt,
    retentionNoticeTargetDay
} from './retention-notices';

/** AC:V9b:10; retention row of outbox §6; D1 excludes owner acts for archive; H7 sends late notices. */
export type SendRetentionNoticeResult =
    | {
          readonly sent: true;
          readonly notice: 'BEFORE_ARCHIVE' | 'BEFORE_DELETION';
          readonly targetAt: Date;
          readonly enqueued: boolean;
      }
    | {
          readonly sent: false;
          readonly reason:
              | 'LISTING_NOT_FOUND'
              | 'STATE_CHANGED'
              | 'NO_NOTICE_FOR_STATUS'
              | 'RETENTION_STOPPED'
              | 'COVERED'
              | 'NOT_DUE';
      };

/** Decides and enqueues one retention notice under the owner's publication lock. */
export async function sendRetentionNotice(args: {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly billing: RetentionBilling;
    readonly clock: Clock;
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly ownerId: string;
    readonly correlationId: string;
}): Promise<SendRetentionNoticeResult> {
    return withPublicationLock({
        unitOfWork: args.unitOfWork,
        userId: args.ownerId,
        vertical: args.vertical,
        work: async (tx) => {
            const listing = await tx.readRetentionListing({
                vertical: args.vertical,
                listingId: args.listingId
            });
            if (!listing) return { sent: false, reason: 'LISTING_NOT_FOUND' } as const;
            if (listing.ownerId !== args.ownerId)
                return { sent: false, reason: 'STATE_CHANGED' } as const;
            let transition: 'PB4' | 'PB5' | null = null;
            let notice: 'BEFORE_ARCHIVE' | 'BEFORE_DELETION';
            switch (listing.publicationStatus) {
                case Status.PUBLISHED:
                case Status.UNPUBLISHED_BY_BILLING:
                    transition = 'PB4';
                    notice = 'BEFORE_ARCHIVE';
                    break;
                case Status.DRAFT:
                    transition = 'PB5';
                    notice = 'BEFORE_ARCHIVE';
                    break;
                case Status.ARCHIVED:
                    notice = 'BEFORE_DELETION';
                    break;
                case Status.MODERATED:
                case Status.PURGED:
                    return { sent: false, reason: 'NO_NOTICE_FOR_STATUS' } as const;
                default: {
                    const exhaustive: never = listing.publicationStatus;
                    return exhaustive;
                }
            }
            const pause = await args.billing.retentionStopped({
                userId: args.ownerId,
                vertical: args.vertical
            });
            if (pause.stopped) return { sent: false, reason: 'RETENTION_STOPPED' } as const;
            const coverage = await args.billing.coverage({
                userId: args.ownerId,
                vertical: args.vertical
            });
            if (coverage.covered) return { sent: false, reason: 'COVERED' } as const;
            const clockStart = retentionClockStart({
                inactiveSince: listing.inactiveSince,
                pauseEndedAt: pause.pauseEndedAt
            });
            let targetAt: Date;
            if (notice === 'BEFORE_ARCHIVE')
                targetAt = archiveDueAt({
                    transition: transition!,
                    clockStart,
                    deadlines: listing.deadlines
                });
            else {
                const lastOwnerActAt = await tx.readLastOwnerActAt({
                    vertical: args.vertical,
                    listingId: listing.id
                });
                targetAt = purgeDueAt({
                    clockStart: inactivityClockStart({ clockStart, lastOwnerActAt }),
                    coverageLostAt: pause.coverageLostAt,
                    deletionAfterDays: listing.deadlines.deletionAfterDays,
                    deletionAnnouncedAt: listing.deletionAnnouncedAt
                });
            }
            const deadlines = await tx.readRetentionNoticeDeadlines({
                deadlinesVersion: listing.deadlinesVersion
            });
            const daysBefore =
                notice === 'BEFORE_ARCHIVE'
                    ? deadlines.beforeArchiveDays
                    : deadlines.beforeDeletionDays;
            const noticeAt = retentionNoticeAt({ targetAt, daysBefore });
            if (args.clock.now() < noticeAt) return { sent: false, reason: 'NOT_DUE' } as const;
            const common = {
                recipientUserId: args.ownerId,
                listingId: listing.id,
                milestone:
                    notice === 'BEFORE_ARCHIVE'
                        ? RETENTION_NOTICE_MILESTONES.BEFORE_ARCHIVE
                        : RETENTION_NOTICE_MILESTONES.BEFORE_DELETION,
                targetDate: retentionNoticeTargetDay({ at: targetAt }),
                correlationId: args.correlationId
            };
            const queued =
                notice === 'BEFORE_ARCHIVE'
                    ? await tx.enqueueRetentionNotice({
                          ...common,
                          template: LISTING_RETENTION_BEFORE_ARCHIVE_TEMPLATE,
                          payload: buildListingRetentionBeforeArchivePayload({
                              vertical: args.vertical,
                              listingId: listing.id,
                              transition: transition!,
                              archiveAt: targetAt
                          })
                      })
                    : await tx.enqueueRetentionNotice({
                          ...common,
                          template: LISTING_RETENTION_BEFORE_DELETION_TEMPLATE,
                          payload: buildListingRetentionBeforeDeletionPayload({
                              vertical: args.vertical,
                              listingId: listing.id,
                              deletionAt: targetAt
                          })
                      });
            return { sent: true, notice, targetAt, enqueued: queued.enqueued } as const;
        }
    });
}
