import type { Clock } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum as Status } from '@repo/schemas';
import type { ModerationFailure } from './moderate-listing';
import {
    buildListingModerationNoticePayload,
    LISTING_MODERATION_LEVEL_CHANGED_TEMPLATE,
    LISTING_MODERATION_LIFTED_TEMPLATE
} from './moderation-notices';
import { resolveLiftTransition } from './moderation-origin';
import { publicationAfterCommit, withPublicationLock } from './publication-lock';
import type {
    PostCommitWarning,
    PublicationAfterCommit,
    PublicationBilling,
    PublicationUnitOfWork,
    PublicationVertical
} from './publication-types';

/**
 * Completed lift. A lift never lowers a published listing, so `lowered` is
 * always empty (kept so callers read one result shape for every transition).
 */
export type LiftModerationResult =
    | { readonly ok: false; readonly reason: ModerationFailure }
    | {
          readonly ok: true;
          readonly transition: 'PB11' | 'PB13';
          readonly publicationStatus:
              | typeof Status.DRAFT
              | typeof Status.UNPUBLISHED_BY_BILLING
              | typeof Status.PUBLISHED;
          readonly lowered: readonly [];
          readonly fixRequestOpen: boolean;
          readonly warnings: readonly PostCommitWarning[];
      };

/**
 * Lifts an admin moderation through PB11 or PB13 under the owner's publication
 * lock (HOS-1997). The lift never chooses between listings: with a free slot in
 * the quota the listing comes back PUBLISHED, with the quota full it comes back
 * approved but unpublished (`UNPUBLISHED_BY_BILLING`), no other listing is
 * touched and the owner's notice says the quota is full. The COUNT of published
 * listings therefore depends only on the quota, not on the path taken; which
 * listings fill it can still change through moderation (F-8V3A2-003).
 */
export async function liftModeration(args: {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly billing: PublicationBilling;
    readonly clock: Clock;
    readonly afterCommit: PublicationAfterCommit;
    readonly adminId: string;
    readonly ownerId: string;
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly reason: string;
    readonly correlationId: string;
    readonly keepFixRequest: boolean;
}): Promise<LiftModerationResult> {
    const reason = args.reason.trim();
    if (!reason) return { ok: false, reason: 'REASON_REQUIRED' };
    const decision = await withPublicationLock({
        unitOfWork: args.unitOfWork,
        userId: args.ownerId,
        vertical: args.vertical,
        work: async (tx) => {
            const listing = await tx.readListing({
                vertical: args.vertical,
                listingId: args.listingId
            });
            if (!listing || listing.ownerId !== args.ownerId)
                return { ok: false, reason: 'LISTING_NOT_FOUND' } as const;
            if (listing.publicationStatus !== Status.MODERATED)
                return { ok: false, reason: 'INVALID_FROM' } as const;
            const transition = resolveLiftTransition({
                origin: await tx.readModerationOrigin({
                    vertical: args.vertical,
                    listingId: listing.id
                })
            });
            const at = args.clock.now();
            const firstTarget =
                transition === 'PB11' ? Status.DRAFT : Status.UNPUBLISHED_BY_BILLING;
            const changed = await tx.setPublicationStatus({
                vertical: args.vertical,
                listingId: listing.id,
                from: Status.MODERATED,
                to: firstTarget,
                inactiveSince: at,
                actorId: args.adminId
            });
            if (!changed) return { ok: false, reason: 'STATE_CHANGED' } as const;
            await tx.insertStatusChangedEvent({
                vertical: args.vertical,
                listingId: listing.id,
                from: Status.MODERATED,
                to: firstTarget,
                oldInactiveSince: listing.inactiveSince,
                inactiveSince: at,
                actorType: 'admin',
                actorId: args.adminId,
                reason,
                correlationId: args.correlationId
            });
            let publicationStatus = firstTarget;
            let quotaFull = false;
            const revalidateIds: string[] = [];
            if (transition === 'PB13') {
                const coverage = await args.billing.coverage({
                    userId: args.ownerId,
                    vertical: args.vertical
                });
                const limit = coverage.covered
                    ? await tx.readDeclaredPublishLimit({
                          userId: args.ownerId,
                          vertical: args.vertical
                      })
                    : null;
                if (coverage.covered && limit !== null) {
                    const publishedCount = await tx.countPublished({
                        vertical: args.vertical,
                        ownerId: args.ownerId
                    });
                    if (publishedCount < limit) {
                        const restored = await tx.setPublicationStatus({
                            vertical: args.vertical,
                            listingId: listing.id,
                            from: Status.UNPUBLISHED_BY_BILLING,
                            to: Status.PUBLISHED,
                            inactiveSince: at
                        });
                        if (!restored)
                            throw new Error('PB3 state changed inside locked transaction');
                        await tx.insertStatusChangedEvent({
                            vertical: args.vertical,
                            listingId: listing.id,
                            from: Status.UNPUBLISHED_BY_BILLING,
                            to: Status.PUBLISHED,
                            oldInactiveSince: at,
                            inactiveSince: at,
                            actorType: 'job',
                            correlationId: args.correlationId
                        });
                        publicationStatus = Status.PUBLISHED;
                        revalidateIds.push(listing.id);
                    } else if (limit > 0) {
                        // Only a quota that exists and is full earns the «unpublish another»
                        // advice; a plan with room for none gets the generic «no room» text.
                        quotaFull = true;
                    }
                }
            }
            let open = await tx.readOpenFixRequest({
                vertical: args.vertical,
                listingId: listing.id
            });
            if (args.keepFixRequest && !open) {
                const created = await tx.openFixRequest({
                    vertical: args.vertical,
                    listingId: listing.id,
                    reason,
                    suggestedDate: null,
                    openedById: args.adminId,
                    openedAt: at
                });
                if (!created.opened)
                    throw new Error('fix request changed inside locked transaction');
                await tx.insertFixRequestEvent({
                    vertical: args.vertical,
                    listingId: listing.id,
                    eventType: 'listing.fix_request_opened',
                    fixRequestId: created.id,
                    actorType: 'admin',
                    actorId: args.adminId,
                    reason,
                    correlationId: args.correlationId,
                    occurredAt: at
                });
                open = {
                    id: created.id,
                    reason,
                    suggestedDate: null,
                    openedAt: at,
                    openedById: args.adminId,
                    ownerReportedFixedAt: null
                };
            } else if (!args.keepFixRequest && open) {
                const closed = await tx.closeOpenFixRequest({
                    vertical: args.vertical,
                    listingId: listing.id,
                    closedAt: at,
                    closedById: args.adminId
                });
                if (closed)
                    await tx.insertFixRequestEvent({
                        vertical: args.vertical,
                        listingId: listing.id,
                        eventType: 'listing.fix_request_closed',
                        fixRequestId: closed.id,
                        actorType: 'admin',
                        actorId: args.adminId,
                        reason,
                        correlationId: args.correlationId,
                        occurredAt: at
                    });
                open = null;
            }
            const template = args.keepFixRequest
                ? LISTING_MODERATION_LEVEL_CHANGED_TEMPLATE
                : LISTING_MODERATION_LIFTED_TEMPLATE;
            await tx.enqueueListingNotice({
                template,
                recipientUserId: args.ownerId,
                payload: {
                    ...buildListingModerationNoticePayload({
                        vertical: args.vertical,
                        listingId: listing.id,
                        reason,
                        returnedTo: publicationStatus,
                        ...(quotaFull ? { quotaFull: true } : {}),
                        fixRequestOpen: Boolean(open)
                    })
                },
                correlationId: args.correlationId,
                occurrenceKey: args.keepFixRequest
                    ? 'moderation-level-changed'
                    : 'moderation-lifted'
            });
            return {
                ok: true,
                transition,
                publicationStatus,
                fixRequestOpen: Boolean(open),
                revalidateIds
            } as const;
        }
    });
    if (!decision.ok) return decision;
    const warnings =
        decision.revalidateIds.length > 0
            ? await publicationAfterCommit({
                  tasks: [
                      {
                          warning: 'REVALIDATION_FAILED',
                          run: () =>
                              args.afterCommit.revalidate({
                                  vertical: args.vertical,
                                  listingIds: decision.revalidateIds
                              })
                      }
                  ]
              })
            : [];
    return {
        ok: true,
        transition: decision.transition,
        publicationStatus: decision.publicationStatus,
        lowered: [],
        fixRequestOpen: decision.fixRequestOpen,
        warnings
    };
}
