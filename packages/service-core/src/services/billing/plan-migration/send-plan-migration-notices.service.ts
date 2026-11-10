import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    asc,
    type DrizzleClient,
    eq,
    getDb,
    gt,
    isNull,
    or,
    planMigrationSubscriptions,
    planMigrations
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types/index.js';
import {
    applyPlanMigrationUpcomingNotice,
    type PlanMigrationUpcomingNoticeResult
} from './plan-migration-upcoming-notice.js';

const logger = createLogger('send-plan-migration-notices');
const inputSchema = z.strictObject({ limit: z.number().int().positive().max(10_000) });

/** One scope row processed by the daily migration notice run. */
export interface PlanMigrationNoticeRunRow {
    readonly planMigrationSubscriptionId: string;
    readonly outcome: PlanMigrationUpcomingNoticeResult['outcome'] | 'FAILED';
    readonly milestone: string | null;
    readonly recalculated: boolean;
    readonly error?: string;
}

/** Counts and row results for a migration notice run. */
export interface SendPlanMigrationNoticesResult {
    readonly enqueued: number;
    readonly alreadyEnqueued: number;
    readonly recalculated: number;
    readonly notDue: number;
    readonly waiting: number;
    readonly skipped: number;
    readonly failed: number;
    readonly rows: readonly PlanMigrationNoticeRunRow[];
}

/** Evaluate every pending retirement row in keyset pages, with one transaction per row. */
export async function sendPlanMigrationNotices(
    /** `limit` is the page size, not a cap on the number of rows processed. */
    input: { readonly limit: number; readonly db?: DrizzleClient },
    ports: { readonly clock: Clock }
): Promise<SendPlanMigrationNoticesResult> {
    const parsed = inputSchema.safeParse({ limit: input.limit });
    if (!parsed.success)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid plan migration notice run limit',
            parsed.error.issues,
            'INVALID_SEND_PLAN_MIGRATION_NOTICES_INPUT'
        );
    const db = input.db ?? getDb();
    const now = ports.clock.now();
    const rows: PlanMigrationNoticeRunRow[] = [];
    const visitedIds = new Set<string>();
    const counts = {
        enqueued: 0,
        alreadyEnqueued: 0,
        recalculated: 0,
        notDue: 0,
        waiting: 0,
        skipped: 0,
        failed: 0
    };
    let cursor: { readonly applicationDate: Date; readonly id: string } | undefined;
    while (true) {
        const selected = await db
            .select({
                id: planMigrationSubscriptions.id,
                applicationDate: planMigrationSubscriptions.applicationDate
            })
            .from(planMigrationSubscriptions)
            .innerJoin(
                planMigrations,
                eq(planMigrations.id, planMigrationSubscriptions.planMigrationId)
            )
            .where(
                and(
                    eq(planMigrationSubscriptions.status, 'PENDIENTE'),
                    eq(planMigrations.reason, 'RETIREMENT'),
                    isNull(planMigrations.cancelledAt),
                    cursor
                        ? or(
                              gt(
                                  planMigrationSubscriptions.applicationDate,
                                  cursor.applicationDate
                              ),
                              and(
                                  eq(
                                      planMigrationSubscriptions.applicationDate,
                                      cursor.applicationDate
                                  ),
                                  gt(planMigrationSubscriptions.id, cursor.id)
                              )
                          )
                        : undefined
                )
            )
            .orderBy(
                asc(planMigrationSubscriptions.applicationDate),
                asc(planMigrationSubscriptions.id)
            )
            .limit(parsed.data.limit);
        if (selected.length === 0) break;
        for (const { id: planMigrationSubscriptionId } of selected) {
            // A row recalculated to a later date can appear again in a subsequent page.
            if (visitedIds.has(planMigrationSubscriptionId)) continue;
            visitedIds.add(planMigrationSubscriptionId);
            try {
                const result = await db.transaction((tx) =>
                    applyPlanMigrationUpcomingNotice({ tx, planMigrationSubscriptionId, now })
                );
                if (result.outcome === 'ENQUEUED') counts.enqueued += 1;
                if (result.outcome === 'ALREADY_ENQUEUED') counts.alreadyEnqueued += 1;
                if (result.outcome === 'NOT_DUE') counts.notDue += 1;
                if (result.outcome === 'WAITING') counts.waiting += 1;
                if (result.outcome === 'SKIPPED') counts.skipped += 1;
                if (result.recalculated) counts.recalculated += 1;
                rows.push({ planMigrationSubscriptionId, ...result });
            } catch (error) {
                counts.failed += 1;
                const message = error instanceof Error ? error.message : String(error);
                logger.error({ planMigrationSubscriptionId, error }, 'Migration notice row failed');
                rows.push({
                    planMigrationSubscriptionId,
                    outcome: 'FAILED',
                    milestone: null,
                    recalculated: false,
                    error: message
                });
            }
        }
        cursor = selected[selected.length - 1];
        if (selected.length < parsed.data.limit) break;
    }
    logger.info(counts, 'Migration notice run finished');
    return { ...counts, rows };
}
