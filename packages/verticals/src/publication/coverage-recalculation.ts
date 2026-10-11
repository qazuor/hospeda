import type { Clock } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum } from '@repo/schemas';
import { publicationAfterCommit, withPublicationLock } from './publication-lock';
import { buildRestitutionPayload } from './publication-notices';
import { orderReturningCandidates, selectSurplusToLower } from './publication-order';
import type {
    PostCommitWarning,
    PublicationAfterCommit,
    PublicationBilling,
    PublicationListing,
    PublicationUnitOfWork,
    PublicationVertical
} from './publication-types';

/** Coverage recalculation reports every changed listing and stamped fact. */
export interface CoverageRecalculationResult {
    readonly lowered: readonly string[];
    readonly loweredBySurplus: readonly string[];
    readonly restored: readonly string[];
    readonly stamped: readonly string[];
    readonly warnings: readonly PostCommitWarning[];
}

/** Applies PB2 or PB3 and the covered-owner surplus reconciliation under one lock. */
export async function recalculateCoverage(args: {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly billing: PublicationBilling;
    readonly clock: Clock;
    readonly afterCommit: PublicationAfterCommit;
    readonly userId: string;
    readonly vertical: PublicationVertical;
    readonly correlationId: string;
    readonly liveLimit?: (input: {
        readonly userId: string;
        readonly vertical: PublicationVertical;
    }) => Promise<number | null>;
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
            const loweredBySurplus: string[] = [];
            const restored: string[] = [];
            const stamped: string[] = [];
            if (!coverage.covered) {
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
                return { lowered, loweredBySurplus, restored, stamped };
            }

            const limit = args.liveLimit
                ? await args.liveLimit({ userId: args.userId, vertical: args.vertical })
                : await tx.readDeclaredPublishLimit({
                      userId: args.userId,
                      vertical: args.vertical
                  });
            const candidatesAtStart = applicable.filter(
                (row) => row.publicationStatus === PublicationStatusEnum.UNPUBLISHED_BY_BILLING
            );
            const publicationRows = applicable.filter(
                (row) =>
                    row.publicationStatus === PublicationStatusEnum.PUBLISHED ||
                    row.publicationStatus === PublicationStatusEnum.UNPUBLISHED_BY_BILLING
            );
            const instants = await tx.readPublicationInstants({
                vertical: args.vertical,
                listingIds: publicationRows.map((row) => row.id)
            });
            const entry = (row: PublicationListing) => ({
                id: row.id,
                createdAt: row.createdAt,
                publishedAt: instants.get(row.id) ?? null
            });
            if (limit !== null) {
                const toLower = selectSurplusToLower({
                    published: applicable
                        .filter((row) => row.publicationStatus === PublicationStatusEnum.PUBLISHED)
                        .map(entry),
                    limit
                });
                for (const candidate of toLower) {
                    const listing = applicable.find((row) => row.id === candidate.id);
                    if (!listing) continue;
                    const changed = await tx.setPublicationStatus({
                        vertical: args.vertical,
                        listingId: listing.id,
                        from: PublicationStatusEnum.PUBLISHED,
                        to: PublicationStatusEnum.UNPUBLISHED_BY_BILLING
                    });
                    if (!changed) continue;
                    await tx.insertStatusChangedEvent({
                        vertical: args.vertical,
                        listingId: listing.id,
                        from: PublicationStatusEnum.PUBLISHED,
                        to: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                        actorType: 'job',
                        correlationId: args.correlationId
                    });
                    lowered.push(listing.id);
                    loweredBySurplus.push(listing.id);
                }
            }

            const excluded = new Set(loweredBySurplus);
            const stampIds = applicable.filter((row) => !excluded.has(row.id)).map((row) => row.id);
            if (stampIds.length > 0)
                await tx.stampInactiveSince({ vertical: args.vertical, listingIds: stampIds, at });
            stamped.push(...stampIds);

            if (limit !== null) {
                const publishedNow = await tx.countPublished({
                    vertical: args.vertical,
                    ownerId: args.userId
                });
                let available = Math.max(0, limit - publishedNow);
                const ordered = orderReturningCandidates({ entries: candidatesAtStart.map(entry) });
                for (const candidate of ordered) {
                    if (available === 0) break;
                    const changed = await tx.setPublicationStatus({
                        vertical: args.vertical,
                        listingId: candidate.id,
                        from: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                        to: PublicationStatusEnum.PUBLISHED,
                        inactiveSince: at
                    });
                    if (!changed) continue;
                    await tx.insertStatusChangedEvent({
                        vertical: args.vertical,
                        listingId: candidate.id,
                        from: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                        to: PublicationStatusEnum.PUBLISHED,
                        oldInactiveSince: at,
                        inactiveSince: at,
                        actorType: 'job',
                        correlationId: args.correlationId
                    });
                    restored.push(candidate.id);
                    available -= 1;
                }
                if (restored.length > 0) {
                    const restoredIds = new Set(restored);
                    await tx.enqueueRestitutionNotice({
                        vertical: args.vertical,
                        ownerId: args.userId,
                        payload: buildRestitutionPayload({
                            vertical: args.vertical,
                            restoredListingIds: restored,
                            notRestoredListingIds: ordered
                                .filter((candidate) => !restoredIds.has(candidate.id))
                                .map((candidate) => candidate.id)
                        }),
                        correlationId: args.correlationId
                    });
                }
            }
            return { lowered, loweredBySurplus, restored, stamped };
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
