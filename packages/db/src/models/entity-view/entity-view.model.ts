/**
 * @file entity-view.model.ts
 *
 * Lean, standalone model for the `entity_views` append-only telemetry table.
 *
 * **Why NOT BaseModelImpl:**
 * `BaseModelImpl` hard-assumes `deletedAt` (soft-delete), `updatedAt` and audit
 * columns (`createdById`, `updatedById`, `adminInfo`) that the `entity_views`
 * table intentionally omits (SPEC-159 tech-analysis §5, approved deviation).
 * Extending `BaseModelImpl` would inherit `softDelete()` / `restore()` / `update()`
 * methods that would throw at runtime because those columns do not exist on the
 * table. A standalone class is the correct choice here — same pattern as any
 * utility table that deviates from the standard audit convention.
 *
 * **Dedup semantics (T-004 contract):**
 * - `unique`  = COUNT(DISTINCT visitor_hash) within the window.
 * - `total`   = number of *deduplicated* visits: repeated views by the same
 *               `visitorHash` for the same entity within a **30-minute bucket**
 *               collapse to one visit. Implemented via
 *               `COUNT(DISTINCT (visitor_hash, floor(epoch/1800)))` using a raw
 *               `sql` fragment (Drizzle does not expose FLOOR/epoch arithmetic as
 *               typed helpers). Raw `sql` inside a model method is acceptable per
 *               repo conventions; all values are bound via Drizzle parameterization
 *               — no untrusted string interpolation.
 *
 * @see packages/db/src/schemas/entity-view/entity_view.dbschema.ts
 * @see SPEC-159 tech-analysis §4–§5
 */

import type { EntityViewStats } from '@repo/schemas';
import type { TrackableEntityType } from '@repo/schemas';
import { lt, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { entityViews } from '../../schemas/entity-view/entity_view.dbschema.ts';
import type {
    InsertEntityView,
    SelectEntityView
} from '../../schemas/entity-view/entity_view.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

// ─── Input / output types ────────────────────────────────────────────────────

/**
 * Input to record a single view event.
 */
export interface InsertViewInput {
    /** Trackable entity type: 'ACCOMMODATION' | 'POST' | 'EVENT'. */
    readonly entityType: TrackableEntityType;
    /** UUID of the viewed entity. */
    readonly entityId: string;
    /**
     * Salted daily hash of the visitor fingerprint, or `'user:<uuid>'` for
     * authenticated viewers. Used for deduplication within the TTL window.
     */
    readonly visitorHash: string;
    /** Whether the viewer was authenticated at the time of the view. */
    readonly isAuthenticated: boolean;
}

/**
 * Input to retrieve aggregated stats for a batch of entities.
 */
export interface GetStatsForEntitiesInput {
    /** Shared entity type for all IDs in the batch. */
    readonly entityType: TrackableEntityType;
    /** Array of entity UUIDs to aggregate. Must not be empty. */
    readonly entityIds: readonly string[];
    /**
     * Rolling window in days. Only 7 and 30 are accepted by the service layer
     * (SPEC-159 §5), but the model accepts any positive integer for flexibility.
     */
    readonly windowDays: number;
}

/**
 * Input to purge telemetry rows older than a given threshold.
 */
export interface PurgeOlderThanInput {
    /**
     * Rows with `viewed_at < NOW() - interval '<days> days'` are hard-deleted.
     * The TTL cron uses 95 days (SPEC-159 §5 / T-011).
     */
    readonly days: number;
}

// ─── Raw DB row shape returned by the stats aggregation query ────────────────

/**
 * Raw shape of one row returned by the `getStatsForEntities` aggregation query.
 * Drizzle returns numeric aggregates as strings from the pg driver; Number()
 * coercion is applied before returning to callers.
 *
 * The index signature is required to satisfy the `Record<string, unknown>`
 * constraint on `db.execute<T>()`.
 */
interface RawStatsRow extends Record<string, unknown> {
    entityId: string;
    unique: string | number;
    total: string | number;
}

// ─── Model ───────────────────────────────────────────────────────────────────

/**
 * Standalone model for the `entity_views` telemetry table (SPEC-159 T-004).
 *
 * Responsibilities:
 *   1. Append view events (fire-and-forget inserts, no synchronous dedup read).
 *   2. Aggregate per-entity stats (unique visitors + deduped total visits) over
 *      a rolling window via a single SQL query.
 *   3. Hard-purge rows older than a TTL threshold (used by the retention cron).
 *
 * All methods accept an optional `tx` parameter to participate in an outer
 * transaction. When omitted, they use the global singleton from `getDb()`.
 *
 * **Singleton export:** `entityViewModel` is the singleton instance for use
 * across the application, mirroring the convention in every other model file.
 */
export class EntityViewModel {
    /**
     * Returns the provided tx if available, otherwise the global db client.
     * Safe to call with undefined.
     */
    private getClient(tx?: DrizzleClient): DrizzleClient {
        return tx ?? getDb();
    }

    /**
     * Appends a single view event to the `entity_views` table.
     *
     * No synchronous dedup check is performed on insert (insert-always strategy,
     * SPEC-159 tech-analysis §4). Deduplication is applied at query time by
     * `getStatsForEntities`.
     *
     * @param input - The view event to record.
     * @param tx - Optional transaction client.
     * @returns The inserted row.
     * @throws {DbError} If the database operation fails.
     */
    async insertView(input: InsertViewInput, tx?: DrizzleClient): Promise<SelectEntityView> {
        const db = this.getClient(tx);
        const logContext = {
            entityType: input.entityType,
            entityId: input.entityId,
            isAuthenticated: input.isAuthenticated
        };

        try {
            const row: InsertEntityView = {
                entityType: input.entityType,
                entityId: input.entityId,
                visitorHash: input.visitorHash,
                isAuthenticated: input.isAuthenticated
                // viewedAt has defaultNow() — omitted so the DB sets it
            };

            const [inserted] = await db.insert(entityViews).values(row).returning();

            if (!inserted) {
                throw new Error('Insert returned no row');
            }

            try {
                logQuery('entityViews', 'insertView', logContext, { id: inserted.id });
            } catch {}

            return inserted;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError('entityViews', 'insertView', logContext, err);
            } catch {}
            throw new DbError('entityViews', 'insertView', logContext, err.message);
        }
    }

    /**
     * Returns aggregated view-count statistics for a batch of entities over a
     * rolling window.
     *
     * **unique** = COUNT(DISTINCT visitor_hash) within the window.
     *
     * **total** = number of deduplicated visits: repeated views by the same
     * `visitorHash` for the same entity within a 30-minute bucket collapse to
     * one visit. Formula:
     * ```sql
     * COUNT(DISTINCT (visitor_hash, FLOOR(EXTRACT(EPOCH FROM viewed_at) / 1800)))
     * ```
     * The 30-minute bucket constant (1800 seconds) is hardcoded here; changing
     * the dedup window requires a schema/model change, not just a parameter,
     * because it affects how historical rows are interpreted.
     *
     * **Zero-view contract:** Entities that have *no* rows in the window are
     * **omitted** from the result array (the SQL query only returns rows that
     * exist in the table). The service layer is responsible for normalizing
     * absent entities to `{ unique: 0, total: 0 }` if a guaranteed response for
     * every requested ID is needed.
     *
     * @param input - entityType, entityIds, and windowDays.
     * @param tx - Optional transaction client.
     * @returns Array of `EntityViewStats` (one entry per entity that has at
     *   least one view in the window). Entities with zero views are omitted.
     * @throws {DbError} If the database operation fails.
     */
    async getStatsForEntities(
        input: GetStatsForEntitiesInput,
        tx?: DrizzleClient
    ): Promise<EntityViewStats[]> {
        const { entityType, entityIds, windowDays } = input;

        if (entityIds.length === 0) {
            return [];
        }

        const db = this.getClient(tx);
        const logContext = { entityType, entityIdCount: entityIds.length, windowDays };

        try {
            const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

            // Build the IN-list using Drizzle's sql tag so values are bound as
            // parameterized placeholders, not interpolated strings.
            // We cast each element to uuid explicitly to match the column type.
            const entityIdList = sql.join(
                entityIds.map((id) => sql`${id}::uuid`),
                sql`, `
            );

            /*
             * Aggregation query:
             *   SELECT
             *     entity_id                                           AS "entityId",
             *     COUNT(DISTINCT visitor_hash)                        AS "unique",
             *     COUNT(DISTINCT (
             *       visitor_hash,
             *       FLOOR(EXTRACT(EPOCH FROM viewed_at) / 1800)
             *     ))                                                  AS "total"
             *   FROM entity_views
             *   WHERE entity_type = $1
             *     AND entity_id IN ($2, $3, …)
             *     AND viewed_at > $windowStart
             *   GROUP BY entity_id
             *
             * The composite DISTINCT on (visitor_hash, 30-min-bucket) deduplicates
             * repeat views from the same visitor within any 30-minute window while
             * counting separate buckets as distinct visits.
             */
            const rows = await db.execute<RawStatsRow>(sql`
                SELECT
                    entity_id                                                    AS "entityId",
                    COUNT(DISTINCT visitor_hash)::int                            AS "unique",
                    COUNT(DISTINCT (
                        visitor_hash,
                        FLOOR(EXTRACT(EPOCH FROM viewed_at) / 1800)
                    ))::int                                                      AS "total"
                FROM entity_views
                WHERE entity_type = ${entityType}::entity_type_enum
                  AND entity_id IN (${entityIdList})
                  AND viewed_at > ${windowStart}
                GROUP BY entity_id
            `);

            // pg driver returns rows as an object with a `rows` property.
            const rawRows: RawStatsRow[] = Array.isArray(rows)
                ? (rows as RawStatsRow[])
                : ((rows as { rows?: RawStatsRow[] }).rows ?? []);

            const stats: EntityViewStats[] = rawRows.map((row) => ({
                entityId: row.entityId,
                unique: Number(row.unique),
                total: Number(row.total)
            }));

            try {
                logQuery('entityViews', 'getStatsForEntities', logContext, {
                    rowCount: stats.length
                });
            } catch {}

            return stats;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError('entityViews', 'getStatsForEntities', logContext, err);
            } catch {}
            throw new DbError('entityViews', 'getStatsForEntities', logContext, err.message);
        }
    }

    /**
     * Hard-deletes all rows with `viewed_at < NOW() - interval '<days> days'`.
     *
     * Intended for the TTL retention cron (SPEC-159 T-011, 95-day horizon).
     * Uses a parameterized interval expression to avoid string interpolation.
     *
     * @param input.days - Retention threshold in days. Rows older than this are deleted.
     * @param tx - Optional transaction client.
     * @returns The number of rows deleted.
     * @throws {DbError} If the database operation fails.
     */
    async purgeOlderThan(input: PurgeOlderThanInput, tx?: DrizzleClient): Promise<number> {
        const { days } = input;
        const db = this.getClient(tx);
        const logContext = { days };

        try {
            const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            const deleted = await db
                .delete(entityViews)
                .where(lt(entityViews.viewedAt, cutoff))
                .returning({ id: entityViews.id });

            const count = deleted.length;

            try {
                logQuery('entityViews', 'purgeOlderThan', logContext, { deleted: count });
            } catch {}

            return count;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError('entityViews', 'purgeOlderThan', logContext, err);
            } catch {}
            throw new DbError('entityViews', 'purgeOlderThan', logContext, err.message);
        }
    }
}

/** Singleton instance of EntityViewModel for use across the application. */
export const entityViewModel = new EntityViewModel();
