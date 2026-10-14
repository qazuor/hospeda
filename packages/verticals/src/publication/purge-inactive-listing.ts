import type { Clock } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum as Status } from '@repo/schemas';
import { withPublicationLock } from './publication-lock';
import type {
    PublicationUnitOfWork,
    PublicationVertical,
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
              | 'NOT_DUE';
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
      };

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

/**
 * TRANS:V:PB9 under the owner's publication lock. Covers AC:V9b:1 and AC:V9b:7, DEC-DATA-005, HOS-1501.
 * Later work: clock reset/two passes (AC:V9b:6, HOS-1503), immediate remote deletion (AC:V9b:3, HOS-1502), billing push (AC:V9b:8, HOS-1503), V9a fact 1 (AC:V9b:9, HOS-1504), and the job (HOS-1503/HOS-1504).
 */
export async function purgeInactiveListing(args: {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly billing: RetentionBilling;
    readonly clock: Clock;
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly ownerId: string;
    readonly correlationId: string;
}): Promise<PurgeInactiveListingResult> {
    return withPublicationLock({
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
            if (coverage.covered) return { purged: false, reason: 'COVERED' };
            const clockStart = retentionClockStart({
                inactiveSince: listing.inactiveSince,
                pauseEndedAt: pause.pauseEndedAt
            });
            const dueAt = purgeDueAt({
                clockStart,
                coverageLostAt: pause.coverageLostAt,
                deletionAfterDays: listing.deadlines.deletionAfterDays,
                deletionAnnouncedAt: listing.deletionAnnouncedAt
            });
            const now = args.clock.now();
            if (now < dueAt) return { purged: false, reason: 'NOT_DUE' };
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
}
