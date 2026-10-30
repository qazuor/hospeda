import type { Clock } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum as Status } from '@repo/schemas';
import { publicationAfterCommit, withPublicationLock } from './publication-lock';
import type {
    PostCommitWarning,
    PublicationUnitOfWork,
    PublicationVertical,
    PurgeAfterCommit
} from './publication-types';
import {
    buildListingPurgedPayload,
    buildPriceAlertClosedPayload,
    LISTING_PURGED_TEMPLATE,
    PRICE_ALERT_CLOSED_TEMPLATE
} from './purge-notices';

/** Actor permitted to initiate PB12. */
export type PurgeActor =
    | { readonly kind: 'owner'; readonly userId: string }
    | {
          readonly kind: 'support';
          readonly adminId: string;
          readonly ownerId: string;
          readonly reason: string;
      };

/** PB12 rejection reasons. */
export type PurgeFailure =
    | 'LISTING_NOT_FOUND'
    | 'NOT_OWNER'
    | 'INVALID_FROM'
    | 'STATE_CHANGED'
    | 'REASON_REQUIRED';

/** Result of a committed purge or a reason why no purge occurred. */
export type PurgeListingResult =
    | { readonly purged: false; readonly reason: PurgeFailure }
    | {
          readonly purged: true;
          readonly from: Status;
          readonly markedMedia: number;
          readonly markedCalendar: number;
          readonly closedAlerts: number;
          readonly warnings: readonly PostCommitWarning[];
      };

const PURGEABLE: readonly Status[] = [
    Status.DRAFT,
    Status.PUBLISHED,
    Status.UNPUBLISHED_BY_BILLING,
    Status.ARCHIVED,
    Status.MODERATED
];

/** Performs PB12 under the owner's publication lock and runs remote work only after commit. */
export async function purgeListing(args: {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly clock: Clock;
    readonly afterCommit: PurgeAfterCommit;
    readonly actor: PurgeActor;
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly correlationId: string;
}): Promise<PurgeListingResult> {
    const ownerId = args.actor.kind === 'owner' ? args.actor.userId : args.actor.ownerId;
    const reason = args.actor.kind === 'support' ? args.actor.reason.trim() : '';
    if (args.actor.kind === 'support' && !reason)
        return { purged: false, reason: 'REASON_REQUIRED' };

    const decision = await withPublicationLock({
        unitOfWork: args.unitOfWork,
        userId: ownerId,
        vertical: args.vertical,
        work: async (tx) => {
            const listing = await tx.readListing({
                vertical: args.vertical,
                listingId: args.listingId
            });
            if (!listing) return { ok: false, reason: 'LISTING_NOT_FOUND' } as const;
            if (listing.ownerId !== ownerId) return { ok: false, reason: 'NOT_OWNER' } as const;
            if (!PURGEABLE.includes(listing.publicationStatus))
                return { ok: false, reason: 'INVALID_FROM' } as const;
            const from = listing.publicationStatus;
            const changed = await tx.setPublicationStatus({
                vertical: args.vertical,
                listingId: listing.id,
                from,
                to: Status.PURGED,
                actorId: args.actor.kind === 'owner' ? ownerId : args.actor.adminId
            });
            if (!changed) return { ok: false, reason: 'STATE_CHANGED' } as const;
            await tx.insertStatusChangedEvent({
                vertical: args.vertical,
                listingId: listing.id,
                from,
                to: Status.PURGED,
                actorType: args.actor.kind === 'owner' ? 'owner' : 'admin',
                actorId: args.actor.kind === 'owner' ? ownerId : args.actor.adminId,
                ...(args.actor.kind === 'support' ? { reason } : {}),
                correlationId: args.correlationId,
                occurredAt: args.clock.now()
            });
            const content = await tx.purgeListingContent({
                vertical: args.vertical,
                listingId: listing.id,
                at: args.clock.now()
            });
            if (content.closedFixRequestId) {
                await tx.insertFixRequestEvent({
                    vertical: args.vertical,
                    listingId: listing.id,
                    eventType: 'listing.fix_request_closed',
                    fixRequestId: content.closedFixRequestId,
                    actorType: args.actor.kind === 'owner' ? 'owner' : 'admin',
                    actorId: args.actor.kind === 'owner' ? ownerId : args.actor.adminId,
                    reason,
                    correlationId: args.correlationId,
                    occurredAt: args.clock.now()
                });
            }
            await tx.enqueueListingNotice({
                template: LISTING_PURGED_TEMPLATE,
                recipientUserId: ownerId,
                payload: buildListingPurgedPayload({
                    vertical: args.vertical,
                    listingId: listing.id,
                    bySupport: args.actor.kind === 'support'
                }),
                correlationId: args.correlationId,
                occurrenceKey: 'listing-purged'
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
            return { ok: true, from, content } as const;
        }
    });

    if (!decision.ok) return { purged: false, reason: decision.reason };
    const tasks: { warning: PostCommitWarning; run: () => Promise<void> }[] = [];
    if (decision.from === Status.PUBLISHED) {
        tasks.push({
            warning: 'REVALIDATION_FAILED',
            run: () =>
                args.afterCommit.revalidate({
                    vertical: args.vertical,
                    listingIds: [args.listingId]
                })
        });
    }
    tasks.push({
        warning: 'PURGE_NOTICE_FAILED',
        run: () => args.afterCommit.emitListingPurged({ listingId: args.listingId })
    });
    for (const media of decision.content.markedMedia) {
        tasks.push({
            warning: 'REMOTE_DELETION_FAILED',
            run: () =>
                args.afterCommit.deleteRemoteMedia({
                    vertical: args.vertical,
                    mediaId: media.mediaId,
                    publicId: media.publicId
                })
        });
    }
    for (const calendar of decision.content.markedCalendar) {
        tasks.push({
            warning: 'REMOTE_DELETION_FAILED',
            run: () =>
                args.afterCommit.revokeCalendarConnection({
                    connectionId: calendar.connectionId,
                    accommodationId: args.listingId,
                    provider: calendar.provider
                })
        });
    }
    const warnings = await publicationAfterCommit({ tasks });
    return {
        purged: true,
        from: decision.from,
        markedMedia: decision.content.markedMedia.length,
        markedCalendar: decision.content.markedCalendar.length,
        closedAlerts: decision.content.closedAlerts.length,
        warnings
    };
}
