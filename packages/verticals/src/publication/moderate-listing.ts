import type { Clock } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum as Status } from '@repo/schemas';
import {
    buildListingModerationNoticePayload,
    LISTING_MODERATED_TEMPLATE,
    LISTING_MODERATION_LEVEL_CHANGED_TEMPLATE
} from './moderation-notices';
import { publicationAfterCommit, withPublicationLock } from './publication-lock';
import type {
    PostCommitWarning,
    PublicationAfterCommit,
    PublicationUnitOfWork,
    PublicationVertical
} from './publication-types';

/** Outcomes shared by the admin moderation operations. */
export type ModerationFailure =
    | 'LISTING_NOT_FOUND'
    | 'REASON_REQUIRED'
    | 'INVALID_FROM'
    | 'STATE_CHANGED'
    | 'ALREADY_OPEN'
    | 'NO_OPEN_FIX_REQUEST';

/** Result of an admin action on listing publication. */
export type TakeDownListingResult =
    | { readonly ok: false; readonly reason: ModerationFailure }
    | { readonly ok: true; readonly warnings: readonly PostCommitWarning[] };

/** Moves a listing to MODERATED, preserving its inactivity clock. */
export async function takeDownListing(args: {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly clock: Clock;
    readonly afterCommit: PublicationAfterCommit;
    readonly adminId: string;
    readonly ownerId: string;
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly reason: string;
    readonly correlationId: string;
}): Promise<TakeDownListingResult> {
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
            const allowed = [
                Status.DRAFT,
                Status.PUBLISHED,
                Status.UNPUBLISHED_BY_BILLING,
                Status.ARCHIVED
            ] as const;
            if (!allowed.includes(listing.publicationStatus as (typeof allowed)[number]))
                return { ok: false, reason: 'INVALID_FROM' } as const;
            const archiveOrigin =
                listing.publicationStatus === Status.ARCHIVED
                    ? (
                          await tx.readArchiveOrigins({
                              vertical: args.vertical,
                              listingIds: [listing.id]
                          })
                      ).get(listing.id)
                    : undefined;
            const open = await tx.readOpenFixRequest({
                vertical: args.vertical,
                listingId: listing.id
            });
            const changed = await tx.setPublicationStatus({
                vertical: args.vertical,
                listingId: listing.id,
                from: listing.publicationStatus,
                to: Status.MODERATED,
                actorId: args.adminId
            });
            if (!changed) return { ok: false, reason: 'STATE_CHANGED' } as const;
            await tx.insertStatusChangedEvent({
                vertical: args.vertical,
                listingId: listing.id,
                from: listing.publicationStatus,
                to: Status.MODERATED,
                actorType: 'admin',
                actorId: args.adminId,
                reason,
                ...(archiveOrigin ? { archiveOrigin } : {}),
                correlationId: args.correlationId
            });
            await tx.enqueueListingNotice({
                template: open
                    ? LISTING_MODERATION_LEVEL_CHANGED_TEMPLATE
                    : LISTING_MODERATED_TEMPLATE,
                recipientUserId: args.ownerId,
                payload: {
                    ...buildListingModerationNoticePayload({
                        vertical: args.vertical,
                        listingId: listing.id,
                        reason,
                        fixRequestOpen: Boolean(open)
                    })
                },
                correlationId: args.correlationId,
                occurrenceKey: open ? 'moderation-level-changed' : 'moderated'
            });
            return {
                ok: true,
                revalidate: listing.publicationStatus === Status.PUBLISHED
            } as const;
        }
    });
    if (!decision.ok) return decision;
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
    return { ok: true, warnings };
}
