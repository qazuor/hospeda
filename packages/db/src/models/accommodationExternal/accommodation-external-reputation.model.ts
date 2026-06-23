import type { AccommodationExternalReputation } from '@repo/schemas';
import type { ExternalReputationRunStatus } from '@repo/schemas';
import { and, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm';
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
     * New run-state columns (`runStatus`, `apifyRunId`, `apifyDatasetId`,
     * `runStartedAt`) are included in the conflict update (SPEC-250).
     * Callers that do not pass these fields will have `undefined` for them,
     * which leaves the corresponding DB columns unchanged on conflict
     * (Drizzle omits `undefined` values from the SET clause).
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
                        // Run-state columns (SPEC-250 Phase 4) — only updated when defined.
                        runStatus: data.runStatus,
                        apifyRunId: data.apifyRunId,
                        apifyDatasetId: data.apifyDatasetId,
                        runStartedAt: data.runStartedAt,
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
     * A reputation row is "eligible for display" when its associated listing:
     *   1. Has NOT been soft-deleted (`deletedAt IS NULL`).
     *   2. Has at least one of the following flags set to true:
     *      - `showReviews` — the host wants to surface review snippets
     *      - `showLink`    — the host wants to surface a link to the platform
     *
     * Listings where BOTH flags are false are considered private (used by
     * the fetcher internally but hidden from guests). Soft-deleted listings
     * are excluded as a defense-in-depth measure even when `showLink` is true.
     * This query joins accommodation_external_reputation with
     * accommodation_external_listings on `listingId` to apply both filters.
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
                        isNull(accommodationExternalListings.deletedAt),
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

    /**
     * Returns all reputation rows that have an active Apify actor run in
     * progress (`run_status IN ('pending', 'running')` and
     * `apify_run_id IS NOT NULL`).
     *
     * Used by the polling cron job (`poll-apify-reputation-runs`) to discover
     * which runs need to be checked. The returned shape includes the fields
     * needed by the poller — in particular, the listing URL (via join) so the
     * adapter's `mapDatasetItems(items, listing)` call can receive a listing
     * object with its URL.
     *
     * The poller safely assumes `apifyRunId` is non-null on every returned row
     * (OQ-1 resolution: the service persists run_status='pending' and
     * apify_run_id atomically in a single upsert, so null-runId pending rows
     * cannot exist in steady state).
     *
     * @param tx - Optional transaction client.
     * @returns Rows with all fields needed for run polling.
     * @throws DbError if the database query fails.
     */
    async findPendingRuns(tx?: DrizzleClient): Promise<PendingRunRow[]> {
        const db = this.getClient(tx);
        const logContext = {};

        try {
            const results = await db
                .select({
                    id: accommodationExternalReputation.id,
                    accommodationId: accommodationExternalReputation.accommodationId,
                    platform: accommodationExternalReputation.platform,
                    listingId: accommodationExternalReputation.listingId,
                    apifyRunId: accommodationExternalReputation.apifyRunId,
                    apifyDatasetId: accommodationExternalReputation.apifyDatasetId,
                    runStatus: accommodationExternalReputation.runStatus,
                    runStartedAt: accommodationExternalReputation.runStartedAt,
                    // Listing URL is needed by mapDatasetItems(items, listing)
                    listingUrl: accommodationExternalListings.url
                })
                .from(accommodationExternalReputation)
                .innerJoin(
                    accommodationExternalListings,
                    eq(accommodationExternalReputation.listingId, accommodationExternalListings.id)
                )
                .where(
                    and(
                        inArray(accommodationExternalReputation.runStatus, ['pending', 'running']),
                        isNotNull(accommodationExternalReputation.apifyRunId)
                    )
                );

            const rows = results as PendingRunRow[];

            try {
                logQuery(this.entityName, 'findPendingRuns', logContext, rows);
            } catch {}

            return rows;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findPendingRuns', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findPendingRuns', logContext, err.message);
        }
    }

    /**
     * Updates only the `run_status` column for a given row.
     *
     * Used by the polling cron to transition a row from `pending` to `running`
     * when Apify confirms the run has started, without overwriting any other
     * columns (e.g. rating, fetchStatus, apifyRunId).
     *
     * @param input - The row ID and the new run status.
     * @param input.id - UUID of the `accommodation_external_reputation` row.
     * @param input.status - The new run status value (`'running'` or `'idle'`).
     * @param tx - Optional transaction client.
     * @returns Promise resolving when the update completes.
     * @throws DbError if the database query fails.
     */
    async updateRunStatus(input: UpdateRunStatusInput, tx?: DrizzleClient): Promise<void> {
        const db = this.getClient(tx);
        const logContext = { id: input.id, status: input.status };

        try {
            await db
                .update(accommodationExternalReputation)
                .set({ runStatus: input.status, updatedAt: new Date() })
                .where(eq(accommodationExternalReputation.id, input.id));

            try {
                logQuery(this.entityName, 'updateRunStatus', logContext, null);
            } catch {}
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'updateRunStatus', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'updateRunStatus', logContext, err.message);
        }
    }
}

// ---------------------------------------------------------------------------
// Supplementary types
// ---------------------------------------------------------------------------

/**
 * Input shape for {@link AccommodationExternalReputationModel.updateRunStatus}.
 */
export interface UpdateRunStatusInput {
    /** UUID of the `accommodation_external_reputation` row to update. */
    readonly id: string;
    /** The new run status to set. */
    readonly status: ExternalReputationRunStatus;
}

/**
 * A row returned by {@link AccommodationExternalReputationModel.findPendingRuns}.
 *
 * Contains the fields needed by the polling cron job to:
 * 1. Call `getApifyRunStatus({ token, runId: row.apifyRunId })`.
 * 2. Construct a minimal listing object for `adapter.mapDatasetItems(items, listing)`.
 * 3. Call `upsertReputation()` or `updateRunStatus()` based on the Apify status.
 */
export interface PendingRunRow {
    /** UUID of the reputation row. Used by `updateRunStatus()`. */
    readonly id: string;
    /** UUID of the accommodation. Used by `upsertReputation()`. */
    readonly accommodationId: string;
    /** Platform (GOOGLE, BOOKING, AIRBNB, OTHER). Used to resolve the adapter. */
    readonly platform: string;
    /** UUID of the linked listing row. */
    readonly listingId: string;
    /**
     * Apify run ID.  Non-null by construction (OQ-1 atomic upsert guarantee):
     * the service always persists `apifyRunId` and `run_status='pending'` in
     * the same upsert, so rows with `run_status IN ('pending','running')` always
     * have a non-null `apifyRunId`.
     */
    readonly apifyRunId: string | null;
    /** Apify dataset ID (may be null when not yet resolved by the poller). */
    readonly apifyDatasetId: string | null;
    /** Current run state — `'pending'` or `'running'`. */
    readonly runStatus: ExternalReputationRunStatus;
    /** Wall-clock time of the `startRun()` call. Used for timeout sweep. */
    readonly runStartedAt: Date | null;
    /**
     * URL of the external listing (joined from `accommodation_external_listings`).
     * Passed to `adapter.mapDatasetItems(items, listing)` as the listing's URL
     * so the adapter can construct the deepLink fallback.
     */
    readonly listingUrl: string;
}

/** Singleton instance of AccommodationExternalReputationModel for use across the application. */
export const accommodationExternalReputationModel = new AccommodationExternalReputationModel();
