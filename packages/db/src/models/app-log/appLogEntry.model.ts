import { type SQL, gte, lt, lte } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { appLogEntries } from '../../schemas/app-log/app_log_entry.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Row type inferred from the app_log_entries table */
type AppLogEntry = typeof appLogEntries.$inferSelect;

/** Insert type inferred from the app_log_entries table */
type AppLogEntryInsert = typeof appLogEntries.$inferInsert;

/**
 * Model for the append-only `app_log_entries` table.
 * Persists WARN/ERROR entries surfaced by the API logger (SPEC-184 / BETA-82)
 * and powers the admin log viewer.
 *
 * Inserts come fire-and-forget from the logger's 'db-sink' hook (via the base
 * `create`); rows are hard-deleted exclusively by the `app-log-purge` job.
 *
 * Custom queries (time-range listing, retention purge) live here because they
 * need range conditions, which the generic BaseModel helpers (equality-only
 * `where`) cannot express.
 */
export class AppLogEntryModel extends BaseModelImpl<AppLogEntry> {
    protected table = appLogEntries;
    public entityName = 'app_log_entries';

    protected getTableName(): string {
        return 'app_log_entries';
    }

    /**
     * Inserts a log entry WITHOUT emitting any DB-layer log (no logQuery /
     * logError).
     *
     * This is the write path used by the logger's db-sink hook. The base
     * `create` logs its own failure via `dbLogger.error(...)`, which is itself
     * dispatched to the sink — so a failed sink insert would re-enter the sink
     * forever while the DB is down. Keeping this path log-free eliminates that
     * feedback loop by construction.
     *
     * @param data - The entry row to insert.
     * @param tx - Optional transaction client.
     * @returns The created entry.
     * @throws The raw driver error on failure — callers MUST catch (the sink
     * is fire-and-forget).
     */
    async createQuiet(data: AppLogEntryInsert, tx?: DrizzleClient): Promise<AppLogEntry> {
        const db = this.getClient(tx);
        const result = await db.insert(appLogEntries).values(data).returning();
        if (!result[0]) {
            throw new Error(`Insert failed for entity '${this.entityName}'`);
        }
        return result[0] as AppLogEntry;
    }

    /**
     * Lists log entries matching the given filters, paginated and sorted by
     * `loggedAt` desc. Equality filters (level/category) and the `loggedAt`
     * date range are applied at the DB layer; pagination + total count come
     * from the base `findAll`.
     *
     * @param filter - Optional equality filters, date range, and pagination.
     * @param tx - Optional transaction client.
     * @returns The matching page of entries and the total count.
     */
    async listEntries(
        filter: {
            level?: string;
            category?: string;
            fromDate?: Date;
            toDate?: Date;
            page?: number;
            pageSize?: number;
        } = {},
        tx?: DrizzleClient
    ): Promise<{ items: AppLogEntry[]; total: number }> {
        const where: Record<string, unknown> = {};
        if (filter.level) where.level = filter.level;
        if (filter.category) where.category = filter.category;

        const conditions: SQL[] = [];
        if (filter.fromDate) conditions.push(gte(appLogEntries.loggedAt, filter.fromDate));
        if (filter.toDate) conditions.push(lte(appLogEntries.loggedAt, filter.toDate));

        return this.findAll(
            where,
            {
                page: filter.page,
                pageSize: filter.pageSize,
                sortBy: 'loggedAt',
                sortOrder: 'desc'
            },
            conditions.length > 0 ? conditions : undefined,
            tx
        );
    }

    /**
     * Hard-deletes entries emitted strictly before the given date.
     * Retention is uniform (30 days for both WARN and ERROR), so a single
     * threshold suffices — unlike cron_runs' differentiated retention.
     *
     * @param input.before - Delete entries with `loggedAt` strictly before this date.
     * @param tx - Optional transaction client.
     * @returns The number of deleted rows.
     */
    async purgeOlderThan(input: { before: Date }, tx?: DrizzleClient): Promise<number> {
        const db = this.getClient(tx);
        const result = await db
            .delete(appLogEntries)
            .where(lt(appLogEntries.loggedAt, input.before))
            .returning({ id: appLogEntries.id });
        return result.length;
    }
}

/** Singleton instance of AppLogEntryModel for use across the application. */
export const appLogEntryModel = new AppLogEntryModel();
