import { and, desc, eq, gte, inArray, lt, lte, or, type SQL } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { cronRuns } from '../../schemas/cron/cron_run.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Row type inferred from the cron_runs table */
type CronRun = typeof cronRuns.$inferSelect;

/**
 * Model for managing cron run history in the database.
 * Extends BaseModel to provide CRUD operations over the append-only `cron_runs` table.
 * Records the outcome of every cron job execution for admin observability.
 *
 * Custom queries (latest-per-job, recent failures, retention purge) live here because
 * they need range/OR conditions and DISTINCT ON, which the generic BaseModel helpers
 * (equality-only `where`) cannot express.
 */
export class CronRunModel extends BaseModelImpl<CronRun> {
    protected table = cronRuns;
    public entityName = 'cron_runs';

    protected getTableName(): string {
        return 'cronRuns';
    }

    /**
     * Lists run records matching the given filters, paginated and sorted by `startedAt` desc.
     * Equality filters (jobName/status/executionMode) and the `startedAt` date range are
     * all applied at the DB layer; pagination + total count come from the base `findAll`.
     *
     * @param filter - Optional equality filters, date range, and pagination.
     * @param tx - Optional transaction client.
     * @returns The matching page of runs and the total count.
     */
    async listRuns(
        filter: {
            jobName?: string;
            status?: string;
            executionMode?: string;
            fromDate?: Date;
            toDate?: Date;
            page?: number;
            pageSize?: number;
        } = {},
        tx?: DrizzleClient
    ): Promise<{ items: CronRun[]; total: number }> {
        const where: Record<string, unknown> = {};
        if (filter.jobName) where.jobName = filter.jobName;
        if (filter.status) where.status = filter.status;
        if (filter.executionMode) where.executionMode = filter.executionMode;

        const conditions: SQL[] = [];
        if (filter.fromDate) conditions.push(gte(cronRuns.startedAt, filter.fromDate));
        if (filter.toDate) conditions.push(lte(cronRuns.startedAt, filter.toDate));

        return this.findAll(
            where,
            {
                page: filter.page,
                pageSize: filter.pageSize,
                sortBy: 'startedAt',
                sortOrder: 'desc'
            },
            conditions.length > 0 ? conditions : undefined,
            tx
        );
    }

    /**
     * Returns the most recent run for each job that has ever recorded a run.
     * One row per distinct `jobName`, ordered by job name.
     *
     * @param tx - Optional transaction client.
     * @returns The latest run per job.
     */
    async getLatestRunPerJob(tx?: DrizzleClient): Promise<CronRun[]> {
        const db = this.getClient(tx);
        const rows = await db
            .selectDistinctOn([cronRuns.jobName])
            .from(cronRuns)
            .orderBy(cronRuns.jobName, desc(cronRuns.startedAt));
        return rows as CronRun[];
    }

    /**
     * Returns the most recent failed/partial/timeout runs across all jobs, newest first.
     *
     * `partial` (completed but reported errors — HOS-918) is included alongside the
     * hard-failure statuses: a soft failure is exactly the kind of thing this list
     * exists to surface, and omitting it would hide half of production's real failures.
     *
     * @param limit - Maximum number of failures to return (default 20).
     * @param tx - Optional transaction client.
     * @returns Recent failed/partial/timeout runs.
     */
    async getRecentFailures(limit = 20, tx?: DrizzleClient): Promise<CronRun[]> {
        const db = this.getClient(tx);
        const rows = await db
            .select()
            .from(cronRuns)
            .where(inArray(cronRuns.status, ['failed', 'partial', 'timeout']))
            .orderBy(desc(cronRuns.createdAt))
            .limit(limit);
        return rows as CronRun[];
    }

    /**
     * Hard-deletes run records past their retention window.
     * Differentiated retention: successes are kept shorter than failures/timeouts.
     * `partial` runs (HOS-918) are diagnostic information about a soft failure, so they
     * share the longer failure-retention window, not the short success window — a row
     * that never matches either branch would never be purged at all.
     *
     * @param input.successBefore - Delete `success` runs created strictly before this date.
     * @param input.failedBefore - Delete `failed`/`partial`/`timeout` runs created strictly before this date.
     * @param tx - Optional transaction client.
     * @returns The number of deleted rows.
     */
    async purgeOlderThan(
        input: { successBefore: Date; failedBefore: Date },
        tx?: DrizzleClient
    ): Promise<number> {
        const db = this.getClient(tx);
        const result = await db
            .delete(cronRuns)
            .where(
                or(
                    and(
                        eq(cronRuns.status, 'success'),
                        lt(cronRuns.createdAt, input.successBefore)
                    ),
                    and(
                        inArray(cronRuns.status, ['failed', 'partial', 'timeout']),
                        lt(cronRuns.createdAt, input.failedBefore)
                    )
                )
            )
            .returning({ id: cronRuns.id });
        return result.length;
    }
}

/** Singleton instance of CronRunModel for use across the application. */
export const cronRunModel = new CronRunModel();
