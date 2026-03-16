import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { and, desc, eq, lt } from 'drizzle-orm';
import { BaseModel } from '../../base/base.model.ts';
import { getDb } from '../../client.ts';
import { revalidationLog } from '../../schemas/revalidation/revalidation-log.dbschema.ts';

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
export class RevalidationLogModel extends BaseModel<RevalidationLogRecord> {
    protected table = revalidationLog;
    protected entityName = 'revalidation_log';

    protected getTableName(): string {
        return 'revalidation_log';
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
