import {
    accommodations,
    and,
    eq,
    experiences,
    getDb,
    isNull,
    planCatalogModel,
    venues
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import type { ListingFeaturedPorts, ListingFeaturedTransaction } from '@repo/verticals';
import { sql } from 'drizzle-orm';
import type { DrizzleClient } from '../../../../../packages/db/src/types';
import type { PublicationVertical } from '../../../../../packages/verticals/src/publication/publication-types';
import { trialMachineLockKey } from '../../../../../packages/verticals/src/trial/trial-lock-key';
import { createBootstrapCoverageReader } from '../listing-access/bootstrap-coverage-reader';
import { getListingAccessPorts } from '../listing-access/ports';
import { getListingPublicationPorts } from '../listing-publication/ports';

/** Builds the production database, billing, and post-commit ports for listing featured sync. */
export function getListingFeaturedPorts(): ListingFeaturedPorts {
    return {
        billing: { coverage: (input) => getListingAccessPorts().billing.coverage(input) },
        reader: planCatalogModel,
        trials: createBootstrapCoverageReader(),
        unitOfWork: {
            runLocked<T>(
                args: { readonly userId: string; readonly vertical: PublicationVertical },
                work: (tx: ListingFeaturedTransaction) => Promise<T>
            ): Promise<T> {
                return getDb().transaction(async (rawTx) => {
                    const tx = rawTx as DrizzleClient;
                    await tx.execute(
                        sql`SELECT pg_advisory_xact_lock(hashtextextended(${trialMachineLockKey(args).key}, 0))`
                    );
                    const listingTx: ListingFeaturedTransaction = {
                        async listOwnerListings(input) {
                            const where = (table: typeof accommodations) =>
                                and(eq(table.ownerId, input.ownerId), isNull(table.deletedAt));
                            switch (input.vertical) {
                                case VerticalEnum.ACCOMMODATION:
                                    return tx
                                        .select({
                                            id: accommodations.id,
                                            featured: accommodations.featuredByEntitlement
                                        })
                                        .from(accommodations)
                                        .where(where(accommodations));
                                case VerticalEnum.VENUE:
                                    return tx
                                        .select({
                                            id: venues.id,
                                            featured: venues.featuredByEntitlement
                                        })
                                        .from(venues)
                                        .where(
                                            and(
                                                eq(venues.ownerId, input.ownerId),
                                                isNull(venues.deletedAt)
                                            )
                                        );
                                case VerticalEnum.EXPERIENCE:
                                    return tx
                                        .select({
                                            id: experiences.id,
                                            featured: experiences.featuredByEntitlement
                                        })
                                        .from(experiences)
                                        .where(
                                            and(
                                                eq(experiences.ownerId, input.ownerId),
                                                isNull(experiences.deletedAt)
                                            )
                                        );
                            }
                        },
                        async setFeatured(input) {
                            const values = {
                                featuredByEntitlement: input.to,
                                updatedAt: new Date()
                            };
                            switch (input.vertical) {
                                case VerticalEnum.ACCOMMODATION:
                                    return (
                                        (
                                            await tx
                                                .update(accommodations)
                                                .set(values)
                                                .where(
                                                    and(
                                                        eq(accommodations.id, input.listingId),
                                                        eq(
                                                            accommodations.featuredByEntitlement,
                                                            input.from
                                                        ),
                                                        isNull(accommodations.deletedAt)
                                                    )
                                                )
                                                .returning({ id: accommodations.id })
                                        ).length === 1
                                    );
                                case VerticalEnum.VENUE:
                                    return (
                                        (
                                            await tx
                                                .update(venues)
                                                .set(values)
                                                .where(
                                                    and(
                                                        eq(venues.id, input.listingId),
                                                        eq(
                                                            venues.featuredByEntitlement,
                                                            input.from
                                                        ),
                                                        isNull(venues.deletedAt)
                                                    )
                                                )
                                                .returning({ id: venues.id })
                                        ).length === 1
                                    );
                                case VerticalEnum.EXPERIENCE:
                                    return (
                                        (
                                            await tx
                                                .update(experiences)
                                                .set(values)
                                                .where(
                                                    and(
                                                        eq(experiences.id, input.listingId),
                                                        eq(
                                                            experiences.featuredByEntitlement,
                                                            input.from
                                                        ),
                                                        isNull(experiences.deletedAt)
                                                    )
                                                )
                                                .returning({ id: experiences.id })
                                        ).length === 1
                                    );
                            }
                        }
                    };
                    return work(listingTx);
                });
            }
        },
        afterCommit: { revalidate: getListingPublicationPorts().afterCommit.revalidate }
    };
}
