import type { AccommodationExternalReputation } from '@repo/schemas';
import { and, eq, or } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { accommodationExternalListings } from '../../schemas/accommodation-external/accommodation_external_listings.dbschema.ts';
import {
    type InsertAccommodationExternalReputation,
    accommodationExternalReputation
} from '../../schemas/accommodation-external/accommodation_external_reputation.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Model for the `accommodation_external_reputation` table (SPEC-237).
 *
 * Manages the cache of aggregate reputation data (rating, review count,
 * snippets) fetched from external platforms. One row per
 * (accommodation, platform) pair — written exclusively by the background
 * fetcher job; read by the public accommodation detail page.
 *
 * Inherits standard CRUD from BaseModelImpl. The table has no soft-delete
 * workflow (no `deletedAt` column) — rows are deleted by hard-delete when
 * the corresponding listing is removed.
 */
export class AccommodationExternalReputationModel extends BaseModelImpl<AccommodationExternalReputation> {
    protected table = accommodationExternalReputation;
    public entityName = 'accommodationExternalReputation';

    protected override readonly validRelationKeys = ['accommodation', 'listing'] as const;

    protected getTableName(): string {
        return 'accommodationExternalReputation';
    }

    /**
     * Inserts or updates a reputation cache row for the given
     * (accommodationId, platform) pair.
     *
     * Uses PostgreSQL `INSERT … ON CONFLICT (accommodation_id, platform)
     * DO UPDATE SET …` so the operation is idempotent — subsequent calls
     * with the same (accommodationId, platform) overwrite the previously
     * cached values rather than inserting a duplicate.
     *
     * The `createdAt` column is intentionally excluded from the conflict
     * update so that the original first-fetch timestamp is preserved across
     * subsequent updates. `updatedAt` is always refreshed.
     *
     * @param data - Full row data for the reputation record. The `id` field
     *   is optional (defaultRandom() is used when omitted).
     * @param tx - Optional transaction client.
     * @returns Promise resolving to the upserted reputation row.
     * @throws DbError if the database query fails.
     */
    async upsertReputation(
        data: InsertAccommodationExternalReputation,
        tx?: DrizzleClient
    ): Promise<AccommodationExternalReputation> {
        const db = this.getClient(tx);
        const logContext = {
            accommodationId: data.accommodationId,
            platform: data.platform
        };
        const now = new Date();

        try {
            const results = await db
                .insert(accommodationExternalReputation)
                .values({ ...data, updatedAt: now })
                .onConflictDoUpdate({
                    target: [
                        accommodationExternalReputation.accommodationId,
                        accommodationExternalReputation.platform
                    ],
                    set: {
                        listingId: data.listingId,
                        rating: data.rating,
                        reviewsCount: data.reviewsCount,
                        deepLink: data.deepLink,
                        snippets: data.snippets,
                        snippetsFetchedAt: data.snippetsFetchedAt,
                        aggregateFetchedAt: data.aggregateFetchedAt,
                        fetchStatus: data.fetchStatus,
                        fetchMessage: data.fetchMessage,
                        updatedAt: now
                    }
                })
                .returning();

            const row = results[0];
            if (!row) {
                throw new Error(
                    `upsertReputation returned no row for accommodation=${data.accommodationId} platform=${data.platform} — unexpected database state`
                );
            }

            try {
                logQuery(this.entityName, 'upsertReputation', logContext, row);
            } catch {}

            return row as AccommodationExternalReputation;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'upsertReputation', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'upsertReputation', logContext, err.message);
        }
    }

    /**
     * Returns cached reputation rows for an accommodation that are eligible
     * to be shown on the public detail page.
     *
     * A reputation row is "eligible for display" when its associated listing
     * has at least one of the following flags set to true:
     *   - `showReviews` — the host wants to surface review snippets
     *   - `showLink`    — the host wants to surface a link to the platform
     *
     * Listings where BOTH flags are false are considered private (used by
     * the fetcher internally but hidden from guests). This query joins
     * accommodation_external_reputation with accommodation_external_listings
     * on `listingId` to apply that filter.
     *
     * @param accommodationId - UUID of the accommodation to query.
     * @param tx - Optional transaction client.
     * @returns Promise resolving to an array of reputation rows whose
     *   associated listing has showReviews OR showLink = true.
     * @throws DbError if the database query fails.
     */
    async findForDisplay(
        accommodationId: string,
        tx?: DrizzleClient
    ): Promise<AccommodationExternalReputation[]> {
        const db = this.getClient(tx);
        const logContext = { accommodationId };

        try {
            const results = await db
                .select({ reputation: accommodationExternalReputation })
                .from(accommodationExternalReputation)
                .innerJoin(
                    accommodationExternalListings,
                    eq(accommodationExternalReputation.listingId, accommodationExternalListings.id)
                )
                .where(
                    and(
                        eq(accommodationExternalReputation.accommodationId, accommodationId),
                        or(
                            eq(accommodationExternalListings.showReviews, true),
                            eq(accommodationExternalListings.showLink, true)
                        )
                    )
                );

            const rows = results.map((r) => r.reputation) as AccommodationExternalReputation[];

            try {
                logQuery(this.entityName, 'findForDisplay', logContext, rows);
            } catch {}

            return rows;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findForDisplay', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findForDisplay', logContext, err.message);
        }
    }
}

/** Singleton instance of AccommodationExternalReputationModel for use across the application. */
export const accommodationExternalReputationModel = new AccommodationExternalReputationModel();
