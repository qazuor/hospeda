import type { Clock } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum } from '@repo/schemas';
import { publicationAfterCommit, withPublicationLock } from './publication-lock';
import type {
    PostCommitWarning,
    PublicationAfterCommit,
    PublicationBilling,
    PublicationListing,
    PublicationUnitOfWork,
    PublicationVertical
} from './publication-types';

/** Provisional PB3 order while V6.3 owns the definitive return criterion. */
export function orderReturningCandidates(args: {
    readonly listings: readonly PublicationListing[];
}): readonly PublicationListing[] {
    // V6.3: reemplaza por el criterio de cuáles vuelven (DEC-SUB-008 inverso, desde el registro de eventos).
    return [...args.listings].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)
    );
}

/** Coverage recalculation reports exactly which listings changed or received a clock fact. */
export interface CoverageRecalculationResult {
    readonly lowered: readonly string[];
    readonly restored: readonly string[];
    readonly stamped: readonly string[];
    readonly warnings: readonly PostCommitWarning[];
}

/** Applies PB2's lost-coverage branch or PB3's covered return under one lock. */
export async function recalculateCoverage(args: {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly billing: PublicationBilling;
    readonly clock: Clock;
    readonly afterCommit: PublicationAfterCommit;
    readonly userId: string;
    readonly vertical: PublicationVertical;
    readonly correlationId: string;
}): Promise<CoverageRecalculationResult> {
    const decision = await withPublicationLock({
        unitOfWork: args.unitOfWork,
        userId: args.userId,
        vertical: args.vertical,
        work: async (tx) => {
            const coverage = await args.billing.coverage({
                userId: args.userId,
                vertical: args.vertical
            });
            const listings = await tx.listByOwner({
                vertical: args.vertical,
                ownerId: args.userId
            });
            const applicable = listings.filter(
                (row) =>
                    row.publicationStatus === PublicationStatusEnum.DRAFT ||
                    row.publicationStatus === PublicationStatusEnum.PUBLISHED ||
                    row.publicationStatus === PublicationStatusEnum.UNPUBLISHED_BY_BILLING
            );
            const at = args.clock.now();
            const lowered: string[] = [];
            const restored: string[] = [];
            const stamped: string[] = [];
            if (coverage.covered) {
                const ids = applicable.map((row) => row.id);
                if (ids.length > 0)
                    await tx.stampInactiveSince({ vertical: args.vertical, listingIds: ids, at });
                stamped.push(...ids);
                const publishedCount = await tx.countPublished({
                    vertical: args.vertical,
                    ownerId: args.userId
                });
                const limit = await tx.readPublishLimit({
                    userId: args.userId,
                    vertical: args.vertical
                });
                let available = Math.max(0, limit - publishedCount);
                const candidates = orderReturningCandidates({
                    listings: applicable.filter(
                        (row) =>
                            row.publicationStatus === PublicationStatusEnum.UNPUBLISHED_BY_BILLING
                    )
                });
                for (const listing of candidates) {
                    if (available === 0) break;
                    const changed = await tx.setPublicationStatus({
                        vertical: args.vertical,
                        listingId: listing.id,
                        from: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                        to: PublicationStatusEnum.PUBLISHED,
                        inactiveSince: at
                    });
                    if (!changed) continue;
                    await tx.insertStatusChangedEvent({
                        vertical: args.vertical,
                        listingId: listing.id,
                        from: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                        to: PublicationStatusEnum.PUBLISHED,
                        oldInactiveSince: at,
                        inactiveSince: at,
                        actorType: 'job',
                        correlationId: args.correlationId
                    });
                    restored.push(listing.id);
                    available -= 1;
                }
            } else {
                for (const listing of applicable) {
                    if (listing.publicationStatus !== PublicationStatusEnum.PUBLISHED) continue;
                    const changed = await tx.setPublicationStatus({
                        vertical: args.vertical,
                        listingId: listing.id,
                        from: PublicationStatusEnum.PUBLISHED,
                        to: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                        inactiveSince: at
                    });
                    if (!changed) continue;
                    await tx.insertStatusChangedEvent({
                        vertical: args.vertical,
                        listingId: listing.id,
                        from: PublicationStatusEnum.PUBLISHED,
                        to: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                        oldInactiveSince: listing.inactiveSince,
                        inactiveSince: at,
                        actorType: 'job',
                        correlationId: args.correlationId
                    });
                    lowered.push(listing.id);
                    stamped.push(listing.id);
                }
                const others = applicable
                    .filter((row) => row.publicationStatus !== PublicationStatusEnum.PUBLISHED)
                    .map((row) => row.id);
                if (others.length > 0)
                    await tx.stampInactiveSince({
                        vertical: args.vertical,
                        listingIds: others,
                        at
                    });
                stamped.push(...others);
            }
            return { lowered, restored, stamped };
        }
    });
    const warnings = await publicationAfterCommit({
        tasks: [
            {
                warning: 'CACHE_INVALIDATION_FAILED',
                run: () => args.afterCommit.invalidateUser({ userId: args.userId })
            },
            {
                warning: 'REVALIDATION_FAILED',
                run: () =>
                    args.afterCommit.revalidate({
                        vertical: args.vertical,
                        listingIds: [...decision.lowered, ...decision.restored]
                    })
            }
        ]
    });
    return { ...decision, warnings };
}
