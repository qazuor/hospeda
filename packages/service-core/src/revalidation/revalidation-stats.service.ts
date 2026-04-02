/**
 * RevalidationStatsService
 *
 * Queries the revalidation_log table to compute aggregated statistics
 * for the admin dashboard. Covers the last 30 days of activity.
 *
 * @module services/revalidation-stats
 */

// Uses getDb() directly because RevalidationLogModel does not expose aggregation methods
// needed for statistics computation (count with groupBy, avg, max, etc.)
import { getDb, revalidationLog } from '@repo/db';
import type { RevalidationStats } from '@repo/schemas';
import { avg, count, gt, max, sql } from 'drizzle-orm';

/**
 * Service for computing aggregated ISR revalidation statistics.
 *
 * Returns a snapshot of the last 30 days of revalidation activity,
 * including success rates, average duration, and breakdowns by entity
 * type and trigger source.
 */
export class RevalidationStatsService {
    /**
     * Computes aggregated revalidation statistics for the last 30 days.
     *
     * @returns A RevalidationStats object with totals, success rate,
     *          average duration, and breakdowns by entityType and trigger.
     */
    async getStats(): Promise<RevalidationStats> {
        const db = getDb();

        // Cutoff: 30 days ago
        const since = new Date();
        since.setDate(since.getDate() - 30);

        // Total count + success count + avg duration + last revalidation in one query
        const [summary] = await db
            .select({
                total: count(),
                successCount: count(
                    sql`CASE WHEN ${revalidationLog.status} = 'success' THEN 1 END`
                ),
                avgDurationMs: avg(revalidationLog.durationMs),
                lastRevalidation: max(revalidationLog.createdAt)
            })
            .from(revalidationLog)
            .where(gt(revalidationLog.createdAt, since));

        const total = Number(summary?.total ?? 0);
        const successCount = Number(summary?.successCount ?? 0);
        const avgDurationMs = Math.round(Number(summary?.avgDurationMs ?? 0));
        const lastRevalidation = summary?.lastRevalidation ?? null;

        const successRate = total > 0 ? successCount / total : 0;

        // Breakdown by entityType
        const entityTypeRows = await db
            .select({
                entityType: revalidationLog.entityType,
                cnt: count()
            })
            .from(revalidationLog)
            .where(gt(revalidationLog.createdAt, since))
            .groupBy(revalidationLog.entityType);

        const byEntityType: Record<string, number> = {};
        for (const row of entityTypeRows) {
            byEntityType[row.entityType] = Number(row.cnt);
        }

        // Breakdown by trigger
        const triggerRows = await db
            .select({
                trigger: revalidationLog.trigger,
                cnt: count()
            })
            .from(revalidationLog)
            .where(gt(revalidationLog.createdAt, since))
            .groupBy(revalidationLog.trigger);

        const byTrigger: Record<string, number> = {};
        for (const row of triggerRows) {
            byTrigger[row.trigger] = Number(row.cnt);
        }

        return {
            totalRevalidations: total,
            successRate,
            avgDurationMs,
            lastRevalidation: lastRevalidation ?? null,
            byEntityType,
            byTrigger
        };
    }
}
