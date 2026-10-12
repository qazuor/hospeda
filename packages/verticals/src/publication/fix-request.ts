import type { Clock } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum as Status } from '@repo/schemas';
import type { ModerationFailure } from './moderate-listing';
import {
    buildListingModerationNoticePayload,
    LISTING_FIX_REQUESTED_TEMPLATE,
    LISTING_MODERATION_LIFTED_TEMPLATE
} from './moderation-notices';
import { withPublicationLock } from './publication-lock';
import type {
    PostCommitWarning,
    PublicationUnitOfWork,
    PublicationVertical
} from './publication-types';

/** Opens a fix request without changing the listing's state or clock. */
export async function requestListingFix(args: {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly clock: Clock;
    readonly adminId: string;
    readonly ownerId: string;
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly reason: string;
    readonly suggestedDate: string | null;
    readonly correlationId: string;
}): Promise<
    | { readonly ok: true; readonly warnings: readonly PostCommitWarning[] }
    | { readonly ok: false; readonly reason: ModerationFailure }
> {
    const reason = args.reason.trim();
    if (!reason) return { ok: false, reason: 'REASON_REQUIRED' };
    return withPublicationLock({
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
            if (listing.publicationStatus === Status.PURGED)
                return { ok: false, reason: 'INVALID_FROM' } as const;
            const openedAt = args.clock.now();
            const opened = await tx.openFixRequest({
                vertical: args.vertical,
                listingId: listing.id,
                reason,
                suggestedDate: args.suggestedDate,
                openedById: args.adminId,
                openedAt
            });
            if (!opened.opened) return { ok: false, reason: 'ALREADY_OPEN' } as const;
            await tx.insertFixRequestEvent({
                vertical: args.vertical,
                listingId: listing.id,
                eventType: 'listing.fix_request_opened',
                fixRequestId: opened.id,
                actorType: 'admin',
                actorId: args.adminId,
                reason,
                correlationId: args.correlationId,
                occurredAt: openedAt
            });
            await tx.enqueueListingNotice({
                template: LISTING_FIX_REQUESTED_TEMPLATE,
                recipientUserId: args.ownerId,
                payload: {
                    ...buildListingModerationNoticePayload({
                        vertical: args.vertical,
                        listingId: listing.id,
                        reason,
                        suggestedDate: args.suggestedDate ?? undefined,
                        fixRequestOpen: true
                    })
                },
                correlationId: args.correlationId,
                occurrenceKey: 'fix-requested'
            });
            return { ok: true, warnings: [] } as const;
        }
    });
}

/** Closes an open fix request on a listing that is not currently moderated. */
export async function closeListingFixRequest(args: {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly clock: Clock;
    readonly adminId: string;
    readonly ownerId: string;
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly reason: string;
    readonly correlationId: string;
}): Promise<
    | { readonly ok: true; readonly warnings: readonly PostCommitWarning[] }
    | { readonly ok: false; readonly reason: ModerationFailure }
> {
    const reason = args.reason.trim();
    if (!reason) return { ok: false, reason: 'REASON_REQUIRED' };
    return withPublicationLock({
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
            if (
                listing.publicationStatus === Status.PURGED ||
                listing.publicationStatus === Status.MODERATED
            )
                return { ok: false, reason: 'INVALID_FROM' } as const;
            const open = await tx.readOpenFixRequest({
                vertical: args.vertical,
                listingId: listing.id
            });
            if (!open) return { ok: false, reason: 'NO_OPEN_FIX_REQUEST' } as const;
            const closedAt = args.clock.now();
            const closed = await tx.closeOpenFixRequest({
                vertical: args.vertical,
                listingId: listing.id,
                closedAt,
                closedById: args.adminId
            });
            if (!closed) return { ok: false, reason: 'NO_OPEN_FIX_REQUEST' } as const;
            await tx.insertFixRequestEvent({
                vertical: args.vertical,
                listingId: listing.id,
                eventType: 'listing.fix_request_closed',
                fixRequestId: closed.id,
                actorType: 'admin',
                actorId: args.adminId,
                reason,
                correlationId: args.correlationId,
                occurredAt: closedAt
            });
            await tx.enqueueListingNotice({
                template: LISTING_MODERATION_LIFTED_TEMPLATE,
                recipientUserId: args.ownerId,
                payload: {
                    ...buildListingModerationNoticePayload({
                        vertical: args.vertical,
                        listingId: listing.id,
                        reason,
                        returnedTo: listing.publicationStatus,
                        fixRequestOpen: false
                    })
                },
                correlationId: args.correlationId,
                occurrenceKey: 'moderation-lifted'
            });
            return { ok: true, warnings: [] } as const;
        }
    });
}
