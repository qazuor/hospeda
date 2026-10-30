import type { Clock } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum as Status } from '@repo/schemas';
import { inactivityClockStart } from './inactivity-clock';
import { publicationAfterCommit, withPublicationLock } from './publication-lock';
import type {
    PostCommitWarning,
    PublicationUnitOfWork,
    PublicationVertical,
    RetentionAfterCommit,
    RetentionBilling
} from './publication-types';
import { buildPriceAlertClosedPayload, PRICE_ALERT_CLOSED_TEMPLATE } from './purge-notices';
import { retentionClockStart } from './retention-clock';

/** Result of PB9 or the exact reason it left the archived listing unchanged. */
export type PurgeInactiveListingResult =
    | {
          readonly purged: false;
          readonly reason:
              | 'LISTING_NOT_FOUND'
              | 'STATE_CHANGED'
              | 'NOT_ARCHIVED'
              | 'RETENTION_STOPPED'
              | 'COVERED'
              | 'NOT_DUE'
              | 'FIRST_PASS';
      }
    | {
          readonly purged: true;
          readonly dueAt: Date;
          readonly markedMedia: readonly {
              readonly mediaId: string;
              readonly publicId: string | null;
          }[];
          readonly markedCalendar: readonly {
              readonly connectionId: string;
              readonly provider: string;
          }[];
          readonly closedAlerts: number;
          readonly warnings: readonly PostCommitWarning[];
      };

type PurgeInactiveListingLockedResult =
    | Extract<PurgeInactiveListingResult, { readonly purged: false }>
    | Omit<Extract<PurgeInactiveListingResult, { readonly purged: true }>, 'warnings'>;

/** Calculates the later of the inactivity deadline and announced deletion date. */
export function purgeDueAt(args: {
    readonly clockStart: Date;
    readonly coverageLostAt: Date | null;
    readonly deletionAfterDays: number;
    readonly deletionAnnouncedAt: Date | null;
}): Date {
    const start =
        args.coverageLostAt && args.coverageLostAt > args.clockStart
            ? args.coverageLostAt
            : args.clockStart;
    const deadline = new Date(start.getTime() + args.deletionAfterDays * 86_400_000);
    return args.deletionAnnouncedAt && args.deletionAnnouncedAt > deadline
        ? args.deletionAnnouncedAt
        : deadline;
}

/** First-pass safety rule for missing coverage loss (AC:V9b:6, TRANS:V:PB9). */
export function isFirstPurgePass(args: {
    readonly coverageLostAt: Date | null;
    readonly dueAt: Date;
    readonly previousPassStartedAt: Date | null;
}): boolean {
    return (
        args.coverageLostAt === null &&
        (args.previousPassStartedAt === null || args.dueAt > args.previousPassStartedAt)
    );
}

/**
 * TRANS:V:PB9 under the owner's publication lock. Covers AC:V9b:1, AC:V9b:3, AC:V9b:6, AC:V9b:7, AC:V9b:8, AC:V9b:9, DEC-DATA-005, HOS-1501, HOS-1502, HOS-1503, HOS-1504.
 * Later work: the pass with its job (HOS-1504, runs 4-5).
 */
export async function purgeInactiveListing(args: {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly billing: RetentionBilling;
    readonly clock: Clock;
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly ownerId: string;
    readonly correlationId: string;
    readonly afterCommit: RetentionAfterCommit;
    /** Start instant of the previous PB9 pass, or null when none has run (H1). */
    readonly previousPassStartedAt: Date | null;
}): Promise<PurgeInactiveListingResult> {
    const result = await withPublicationLock<PurgeInactiveListingLockedResult>({
        unitOfWork: args.unitOfWork,
        userId: args.ownerId,
        vertical: args.vertical,
        work: async (tx) => {
            const listing = await tx.readRetentionListing({
                vertical: args.vertical,
                listingId: args.listingId
            });
            if (!listing) return { purged: false, reason: 'LISTING_NOT_FOUND' };
            if (listing.ownerId !== args.ownerId) return { purged: false, reason: 'STATE_CHANGED' };
            if (listing.publicationStatus !== Status.ARCHIVED)
                return { purged: false, reason: 'NOT_ARCHIVED' };
            const pause = await args.billing.retentionStopped({
                userId: args.ownerId,
                vertical: args.vertical
            });
            if (pause.stopped) return { purged: false, reason: 'RETENTION_STOPPED' };
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
                return { purged: false, reason: 'COVERED' };
            }
            const lastOwnerActAt = await tx.readLastOwnerActAt({
                vertical: args.vertical,
                listingId: listing.id
            });
            const clockStart = inactivityClockStart({
                clockStart: retentionClockStart({
                    inactiveSince: listing.inactiveSince,
                    pauseEndedAt: pause.pauseEndedAt
                }),
                lastOwnerActAt
            });
            const dueAt = purgeDueAt({
                clockStart,
                coverageLostAt: pause.coverageLostAt,
                deletionAfterDays: listing.deadlines.deletionAfterDays,
                deletionAnnouncedAt: listing.deletionAnnouncedAt
            });
            const now = args.clock.now();
            if (now < dueAt) return { purged: false, reason: 'NOT_DUE' };
            if (
                isFirstPurgePass({
                    coverageLostAt: pause.coverageLostAt,
                    dueAt,
                    previousPassStartedAt: args.previousPassStartedAt
                })
            )
                return { purged: false, reason: 'FIRST_PASS' };
            const changed = await tx.setPublicationStatus({
                vertical: args.vertical,
                listingId: listing.id,
                from: Status.ARCHIVED,
                to: Status.PURGED
            });
            if (!changed) return { purged: false, reason: 'STATE_CHANGED' };
            await tx.insertStatusChangedEvent({
                vertical: args.vertical,
                listingId: listing.id,
                from: Status.ARCHIVED,
                to: Status.PURGED,
                actorType: 'job',
                correlationId: args.correlationId,
                occurredAt: now
            });
            const content = await tx.purgeListingContent({
                vertical: args.vertical,
                listingId: listing.id,
                at: now
            });
            for (const alert of content.closedAlerts) {
                await tx.enqueueListingNotice({
                    template: PRICE_ALERT_CLOSED_TEMPLATE,
                    recipientUserId: alert.touristUserId,
                    payload: buildPriceAlertClosedPayload({
                        vertical: args.vertical,
                        listingId: listing.id,
                        alertId: alert.alertId
                    }),
                    correlationId: args.correlationId,
                    occurrenceKey: `price-alert-closed:${alert.alertId}`
                });
            }
            return {
                purged: true,
                dueAt,
                markedMedia: content.markedMedia,
                markedCalendar: content.markedCalendar,
                closedAlerts: content.closedAlerts.length
            };
        }
    });
    if (!result.purged) return result;
    const warnings = await publicationAfterCommit({
        tasks: [
            {
                warning: 'PURGE_NOTICE_FAILED' as const,
                run: () => args.afterCommit.emitListingPurged({ listingId: args.listingId })
            },
            ...result.markedMedia.map((media) => ({
                warning: 'REMOTE_DELETION_FAILED' as const,
                run: () =>
                    args.afterCommit.deleteRemoteMedia({
                        vertical: args.vertical,
                        mediaId: media.mediaId,
                        publicId: media.publicId
                    })
            })),
            ...result.markedCalendar.map((connection) => ({
                warning: 'REMOTE_DELETION_FAILED' as const,
                run: () =>
                    args.afterCommit.revokeCalendarConnection({
                        connectionId: connection.connectionId,
                        accommodationId: args.listingId,
                        provider: connection.provider
                    })
            }))
        ]
    });
    return { ...result, warnings };
}
