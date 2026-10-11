import type { Clock } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum, type VerticalActivationEvent } from '@repo/schemas';
import { consumeTrialInTransaction } from '../trial/trial-consume';
import { evaluateTrialStart, startTrialInTransaction } from '../trial/trial-start';
import type { TrialStartDeniedReason } from '../trial/trial-start-types';
import { publicationAfterCommit, withPublicationLock } from './publication-lock';
import type {
    PostCommitWarning,
    PublicationAfterCommit,
    PublicationBilling,
    PublicationUnitOfWork,
    PublicationVertical
} from './publication-types';

/** A normal PB1 rejection, distinct from infrastructure errors. */
export type PublishDeniedReason =
    | 'LISTING_NOT_FOUND'
    | 'NOT_OWNER'
    | 'INVALID_FROM'
    | 'COVERED_USE_PB3'
    | 'LIMIT_REACHED'
    | 'TRIAL_LIMIT_REACHED'
    | 'STATE_CHANGED'
    | TrialStartDeniedReason;

/** PB1's committed result and any independent post-commit warnings. */
export type PublishListingResult =
    | { readonly published: false; readonly reason: PublishDeniedReason }
    | {
          readonly published: true;
          readonly trialStarted: boolean;
          readonly trialConsumed: boolean;
          readonly warnings: readonly PostCommitWarning[];
      };

/** Publishes immediately under the shared lock, starting T1 in that transaction when eligible. */
export async function publishListing(args: {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly billing: PublicationBilling;
    readonly clock: Clock;
    readonly afterCommit: PublicationAfterCommit;
    readonly userId: string;
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly event: VerticalActivationEvent;
    readonly emailPseudonym: string;
    readonly correlationId: string;
}): Promise<PublishListingResult> {
    const decision = await withPublicationLock({
        unitOfWork: args.unitOfWork,
        userId: args.userId,
        vertical: args.vertical,
        work: async (tx) => {
            const listing = await tx.readListing({
                vertical: args.vertical,
                listingId: args.listingId
            });
            if (!listing) return { published: false, reason: 'LISTING_NOT_FOUND' } as const;
            if (listing.ownerId !== args.userId)
                return { published: false, reason: 'NOT_OWNER' } as const;
            if (
                listing.publicationStatus !== PublicationStatusEnum.DRAFT &&
                listing.publicationStatus !== PublicationStatusEnum.UNPUBLISHED_BY_BILLING
            ) {
                return { published: false, reason: 'INVALID_FROM' } as const;
            }
            const from = listing.publicationStatus;
            const coverage = await args.billing.coverage({
                userId: args.userId,
                vertical: args.vertical
            });
            let trialStarted = false;
            let trialConsumed = false;
            if (coverage.covered) {
                if (from === PublicationStatusEnum.UNPUBLISHED_BY_BILLING) {
                    return { published: false, reason: 'COVERED_USE_PB3' } as const;
                }
                const limit = await tx.readPublishLimit({
                    userId: args.userId,
                    vertical: args.vertical
                });
                const count = await tx.countPublished({
                    vertical: args.vertical,
                    ownerId: args.userId
                });
                if (count >= limit) return { published: false, reason: 'LIMIT_REACHED' } as const;
                const consumed = await consumeTrialInTransaction({
                    tx,
                    coverage,
                    input: {
                        userId: args.userId,
                        vertical: args.vertical,
                        emailPseudonym: args.emailPseudonym,
                        expectedEvent: args.event
                    }
                });
                trialConsumed = consumed.consumed;
            } else {
                const count = await tx.countPublished({
                    vertical: args.vertical,
                    ownerId: args.userId
                });
                if (count > 0) return { published: false, reason: 'TRIAL_LIMIT_REACHED' } as const;
                const input = {
                    userId: args.userId,
                    vertical: args.vertical,
                    event: args.event,
                    emailPseudonym: args.emailPseudonym
                };
                const preflight = await evaluateTrialStart({
                    reader: tx,
                    billing: args.billing,
                    input
                });
                if (!preflight.starts)
                    return { published: false, reason: preflight.reason } as const;
                const trial = await startTrialInTransaction({
                    tx,
                    billing: args.billing,
                    clock: args.clock,
                    input
                });
                if (!trial.started) return { published: false, reason: trial.reason } as const;
                trialStarted = true;
            }
            const at = args.clock.now();
            const changed = await tx.setPublicationStatus({
                vertical: args.vertical,
                listingId: args.listingId,
                from,
                to: PublicationStatusEnum.PUBLISHED,
                inactiveSince: at,
                actorId: args.userId
            });
            if (!changed) throw new Error('publication status changed inside locked transaction');
            await tx.insertStatusChangedEvent({
                vertical: args.vertical,
                listingId: args.listingId,
                from,
                to: PublicationStatusEnum.PUBLISHED,
                oldInactiveSince: listing.inactiveSince,
                inactiveSince: at,
                actorType: 'owner',
                actorId: args.userId,
                correlationId: args.correlationId
            });
            return { published: true, trialStarted, trialConsumed } as const;
        }
    });
    if (!decision.published) return decision;
    const warnings = await publicationAfterCommit({
        tasks: [
            ...(decision.trialStarted
                ? [
                      {
                          warning: 'COVERAGE_NOTICE_FAILED' as const,
                          run: () =>
                              args.afterCommit.emitCoverageChanged({
                                  userId: args.userId,
                                  vertical: args.vertical,
                                  sourceType: 'TRIAL',
                                  change: 'CHANGED'
                              })
                      }
                  ]
                : []),
            ...(decision.trialConsumed
                ? [
                      {
                          warning: 'COVERAGE_NOTICE_FAILED' as const,
                          run: () =>
                              args.afterCommit.emitCoverageChanged({
                                  userId: args.userId,
                                  vertical: args.vertical,
                                  sourceType: 'TRIAL',
                                  change: 'REMOVED'
                              })
                      }
                  ]
                : []),
            {
                warning: 'CACHE_INVALIDATION_FAILED',
                run: () => args.afterCommit.invalidateUser({ userId: args.userId })
            },
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
