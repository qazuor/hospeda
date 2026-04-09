import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { and, count, desc, eq, gte, lt, lte } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { getDb } from '../../client.ts';
import { revalidationLog } from '../../schemas/revalidation/revalidation-log.dbschema.ts';
import { safeIlike } from '../../utils/drizzle-helpers.ts';

/**
 * Inferred row type for the revalidation_log table.
 */
export type RevalidationLogRecord = InferSelectModel<typeof revalidationLog>;

/**
 * Inferred insert type for the revalidation_log table.
 */
export type InsertRevalidationLog = InferInsertModel<typeof revalidationLog>;

/**
 * Model for the revalidation_log table.
 * Records every ISR revalidation attempt with outcome and diagnostic metadata.
 */
export class RevalidationLogModel extends BaseModelImpl<RevalidationLogRecord> {
    protected table = revalidationLog;
    public entityName = 'revalidation_log';

    protected getTableName(): string {
        return 'revalidationLog';
    }

    /**
     * Deletes all log entries whose createdAt timestamp is older than the given date.
     *
     * @param date - Cutoff date; rows strictly before this date are removed
     * @returns Promise resolving to the count of deleted rows
     */
    async deleteOlderThan(date: Date): Promise<number> {
        const db = getDb();
        const deleted = await db
            .delete(revalidationLog)
            .where(lt(revalidationLog.createdAt, date))
            .returning({ id: revalidationLog.id });
        return deleted.length;
    }

    /**
     * Finds revalidation log entries with advanced filtering support.
     *
     * Supports exact-match filters (entityType, entityId, trigger, status),
     * substring matching on `path` (case-insensitive ILIKE), and date-range
     * filtering on `createdAt` via `fromDate` / `toDate`.
     *
     * @param filters - Filter criteria including optional path, fromDate, toDate
     * @param options - Pagination options (page, pageSize)
     * @returns Promise resolving to paginated items and total count
     */
    async findWithFilters(
        filters: {
            readonly entityType?: string;
            readonly entityId?: string;
            readonly trigger?: string;
            readonly status?: string;
            readonly path?: string;
            readonly fromDate?: Date;
            readonly toDate?: Date;
        },
        options: { readonly page?: number; readonly pageSize?: number } = {}
    ): Promise<{ items: RevalidationLogRecord[]; total: number }> {
        const db = getDb();

        const page = options.page ?? 1;
        const pageSize = Math.min(options.pageSize ?? 50, 100);
        const offset = (page - 1) * pageSize;

        const clauses = [];

        if (filters.entityType) {
            clauses.push(eq(revalidationLog.entityType, filters.entityType));
        }
        if (filters.entityId) {
            clauses.push(eq(revalidationLog.entityId, filters.entityId));
        }
        if (filters.trigger) {
            clauses.push(eq(revalidationLog.trigger, filters.trigger));
        }
        if (filters.status) {
            clauses.push(eq(revalidationLog.status, filters.status));
        }
        if (filters.path) {
            clauses.push(safeIlike(revalidationLog.path, filters.path));
        }
        if (filters.fromDate) {
            clauses.push(gte(revalidationLog.createdAt, filters.fromDate));
        }
        if (filters.toDate) {
            clauses.push(lte(revalidationLog.createdAt, filters.toDate));
        }

        const whereClause = clauses.length > 0 ? and(...clauses) : undefined;

        const [items, totalResult] = await Promise.all([
            db
                .select()
                .from(revalidationLog)
                .where(whereClause)
                .orderBy(desc(revalidationLog.createdAt))
                .limit(pageSize)
                .offset(offset),
            db.select({ count: count() }).from(revalidationLog).where(whereClause)
        ]);

        return { items, total: Number(totalResult[0]?.count ?? 0) };
    }

    /**
     * Finds the most recent cron-triggered log entry for the given entity type.
     * Only considers entries with trigger='cron' to avoid manual revalidations
     * being mistaken for scheduled runs.
     *
     * @param entityType - The entity type key to look up
     * @returns Promise resolving to the latest cron log row, or undefined if none exists
     */
    async findLastCronEntry(entityType: string): Promise<RevalidationLogRecord | undefined> {
        const db = getDb();
        const results = await db
            .select()
            .from(revalidationLog)
            .where(
                and(eq(revalidationLog.entityType, entityType), eq(revalidationLog.trigger, 'cron'))
            )
            .orderBy(desc(revalidationLog.createdAt))
            .limit(1);
        return results[0];
    }
}
