import { type SQL, gte, lt, lte } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { appLogEntries } from '../../schemas/app-log/app_log_entry.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { safeIlike } from '../../utils/drizzle-helpers.ts';

/**
 * Validated sort input for app log list queries.
 * Field is constrained to the whitelisted sortable columns; direction is asc | desc.
 * This type is intentionally inline (not imported from @repo/schemas) so the db
 * package stays independent of the schemas package at the type level.
 */
export interface AppLogEntrySortInput {
    /** Whitelisted sortable field — only loggedAt and level are accepted */
    field: 'loggedAt' | 'level';
    /** Sort direction */
    direction: 'asc' | 'desc';
}

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
     * Lists log entries matching the given filters, paginated and sorted.
     *
     * Equality filters (level/category/requestId/userId/method) and the `loggedAt`
     * date range are applied at the DB layer. `path` is a case-insensitive
     * substring match via {@link safeIlike} (auto-escapes LIKE wildcards, per
     * the project-wide injection guard). Pagination + total count come from
     * the base `findAll`.
     *
     * The sort field is whitelisted to `loggedAt` and `level` only — the caller
     * MUST validate the field name before passing it here. The default sort is
     * `loggedAt desc` when no sort input is provided.
     *
     * @param filter - Optional filters (equality, date range, path substring), pagination, and sort.
     * @param tx - Optional transaction client.
     * @returns The matching page of entries and the total count.
     */
    async listEntries(
        filter: {
            level?: string;
            category?: string;
            fromDate?: Date;
            toDate?: Date;
            /** Exact match on request correlation ID */
            requestId?: string;
            /** Exact match on authenticated user UUID */
            userId?: string;
            /** Exact match on HTTP method (e.g. 'GET', 'POST') */
            method?: string;
            /** Case-insensitive substring match on request path */
            path?: string;
            page?: number;
            pageSize?: number;
            /**
             * Validated sort input. Field must be a whitelisted column name.
             * When absent the default is loggedAt desc.
             */
            sort?: AppLogEntrySortInput;
        } = {},
        tx?: DrizzleClient
    ): Promise<{ items: AppLogEntry[]; total: number }> {
        const where: Record<string, unknown> = {};
        if (filter.level) where.level = filter.level;
        if (filter.category) where.category = filter.category;
        if (filter.requestId) where.requestId = filter.requestId;
        if (filter.userId) where.userId = filter.userId;
        if (filter.method) where.method = filter.method;

        const conditions: SQL[] = [];
        if (filter.fromDate) conditions.push(gte(appLogEntries.loggedAt, filter.fromDate));
        if (filter.toDate) conditions.push(lte(appLogEntries.loggedAt, filter.toDate));
        if (filter.path) conditions.push(safeIlike(appLogEntries.path, filter.path));

        const sortBy = filter.sort?.field ?? 'loggedAt';
        const sortOrder = filter.sort?.direction ?? 'desc';

        return this.findAll(
            where,
            {
                page: filter.page,
                pageSize: filter.pageSize,
                sortBy,
                sortOrder
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
