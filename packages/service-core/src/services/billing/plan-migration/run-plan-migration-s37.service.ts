import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    asc,
    type DrizzleClient,
    eq,
    getDb,
    gt,
    gte,
    inArray,
    isNull,
    lt,
    or,
    PLAN_MIGRATION_REASONS,
    planMigrationSubscriptions,
    planMigrations
} from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { getLocalDateString } from '@repo/utils';
import { z } from 'zod';
import { ServiceError } from '../../../types/index.js';
import {
    type PlanMigrationS37Result,
    runPlanMigrationS37ForRow
} from './plan-migration-s37.service.js';
import { PLAN_MIGRATION_S37_LEAD_DAYS } from './plan-migration-s37-guards.js';

const logger = createLogger('run-plan-migration-s37');

const inputSchema = z.strictObject({
    /** Page size of the keyset walk; not a cap on the number of rows processed. */
    limit: z.number().int().positive().max(10_000),
    /** Correlation of the whole run; a fresh one is minted per row when absent. */
    correlationId: z.uuid().optional()
});

/** Public outcome of one row inside a batch `S37` run. */
export type PlanMigrationS37RunOutcome = PlanMigrationS37Result['outcome'];

/** One migration row processed (or failed) by the batch `S37` run. */
export interface PlanMigrationS37RunRow {
    readonly planMigrationSubscriptionId: string;
    readonly outcome: PlanMigrationS37RunOutcome | 'FAILED';
    readonly reason?: string;
    readonly escalated?: boolean;
    readonly error?: string;
}

/** Counts and per-row results of one batch `S37` run. */
export interface RunPlanMigrationS37Result {
    readonly skipped: number;
    readonly waiting: number;
    readonly notDue: number;
    readonly appliedManual: number;
    readonly noticePending: number;
    readonly notAuthorized: number;
    readonly appliedCard: number;
    readonly notApplied: number;
    readonly mutatedButRowLeft: number;
    readonly awaitingSweep: number;
    readonly diverged: number;
    readonly escalated: number;
    readonly failed: number;
    readonly failedIds: readonly string[];
    readonly rows: readonly PlanMigrationS37RunRow[];
}

interface S37Counts {
    skipped: number;
    waiting: number;
    notDue: number;
    appliedManual: number;
    noticePending: number;
    notAuthorized: number;
    appliedCard: number;
    notApplied: number;
    mutatedButRowLeft: number;
    awaitingSweep: number;
    diverged: number;
    escalated: number;
    failed: number;
}

const initialCounts: S37Counts = {
    skipped: 0,
    waiting: 0,
    notDue: 0,
    appliedManual: 0,
    noticePending: 0,
    notAuthorized: 0,
    appliedCard: 0,
    notApplied: 0,
    mutatedButRowLeft: 0,
    awaitingSweep: 0,
    diverged: 0,
    escalated: 0,
    failed: 0
};

/**
 * Runs `S37` over every retirement row whose application date falls inside the
 * seven-day lead window (TRANS:B:S37, `B12.md:575-583`).
 *
 * The walk is a KEYSET over `(application_date, id)`: the cursor always comes
 * from the last row actually read from the database (`send-plan-migration-notices`
 * is the mould), never an offset nor a `Date` rebuilt in JS. A row whose outcome
 * leaves it `PENDIENTE` (`NOTICE_PENDING`, `AWAITING_SWEEP`) stays eligible, so a
 * plain `.limit` would re-read it forever and starve the rest of the queue: that
 * is the HOS-2104 bug this shape avoids.
 *
 * One row that throws is recorded and counted, and the run keeps walking: a single
 * poisoned row never cuts the batch.
 *
 * @param input.limit - Page size of the keyset walk
 * @param input.correlationId - Correlation of the run (minted per row when absent)
 * @param ports.provider - The injected payment provider port (never its adapter)
 * @param ports.clock - The injected clock
 * @returns Counts by outcome, the escalated tally, the failed ids and every row
 */
export async function runPlanMigrationS37(
    input: { readonly limit: number; readonly correlationId?: string },
    ports: { readonly provider: PaymentProvider; readonly clock: Clock }
): Promise<RunPlanMigrationS37Result> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid plan migration S37 run input',
            parsed.error.issues,
            'INVALID_RUN_PLAN_MIGRATION_S37_INPUT'
        );
    const db: DrizzleClient = getDb();
    const now = ports.clock.now();
    const today = getLocalDateString({ instant: now });
    const windowEndExclusive = new Date(
        `${shiftLocalDay(today, PLAN_MIGRATION_S37_LEAD_DAYS + 1)}T00:00:00.000Z`
    );
    const windowStart = new Date(`${today}T00:00:00.000Z`);
    const counts: S37Counts = { ...initialCounts };
    const rows: PlanMigrationS37RunRow[] = [];
    const failedIds: string[] = [];
    const visitedIds = new Set<string>();
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
                    inArray(planMigrations.reason, [...PLAN_MIGRATION_REASONS]),
                    isNull(planMigrations.cancelledAt),
                    gte(planMigrationSubscriptions.applicationDate, windowStart),
                    lt(planMigrationSubscriptions.applicationDate, windowEndExclusive),
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
            // A row whose date moved forward can show up again in a later page.
            if (visitedIds.has(planMigrationSubscriptionId)) continue;
            visitedIds.add(planMigrationSubscriptionId);
            try {
                const result = await runPlanMigrationS37ForRow(
                    {
                        planMigrationSubscriptionId,
                        correlationId: parsed.data.correlationId ?? crypto.randomUUID()
                    },
                    { provider: ports.provider, clock: ports.clock }
                );
                tally(counts, result);
                rows.push(toRunRow(planMigrationSubscriptionId, result));
            } catch (error) {
                counts.failed += 1;
                failedIds.push(planMigrationSubscriptionId);
                const message = error instanceof Error ? error.message : String(error);
                logger.error(
                    { planMigrationSubscriptionId, error },
                    'Plan migration S37 row failed'
                );
                rows.push({ planMigrationSubscriptionId, outcome: 'FAILED', error: message });
            }
        }
        const last = selected[selected.length - 1];
        if (!last) break;
        if (
            cursor &&
            cursor.applicationDate.getTime() === last.applicationDate.getTime() &&
            cursor.id === last.id
        )
            break;
        cursor = last;
        if (selected.length < parsed.data.limit) break;
    }
    logger.info(
        {
            ...counts,
            failedIds,
            ...(parsed.data.correlationId ? { correlationId: parsed.data.correlationId } : {})
        },
        'Plan migration S37 run finished'
    );
    return { ...counts, failedIds, rows };
}

function tally(counts: S37Counts, result: PlanMigrationS37Result): void {
    switch (result.outcome) {
        case 'SKIPPED':
            counts.skipped += 1;
            return;
        case 'WAITING':
            counts.waiting += 1;
            return;
        case 'NOT_DUE':
            counts.notDue += 1;
            return;
        case 'APPLIED_MANUAL':
            counts.appliedManual += 1;
            return;
        case 'NOTICE_PENDING':
            counts.noticePending += 1;
            return;
        case 'NOT_AUTHORIZED':
            counts.notAuthorized += 1;
            return;
        case 'APPLIED_CARD':
            counts.appliedCard += 1;
            if (result.escalated) counts.escalated += 1;
            return;
        case 'NOT_APPLIED':
            counts.notApplied += 1;
            return;
        case 'MUTATED_BUT_ROW_LEFT':
            counts.mutatedButRowLeft += 1;
            return;
        case 'AWAITING_SWEEP':
            counts.awaitingSweep += 1;
            return;
        case 'DIVERGED':
            counts.diverged += 1;
            return;
    }
}

function toRunRow(
    planMigrationSubscriptionId: string,
    result: PlanMigrationS37Result
): PlanMigrationS37RunRow {
    if (
        result.outcome === 'SKIPPED' ||
        result.outcome === 'WAITING' ||
        result.outcome === 'NOT_DUE'
    )
        return { planMigrationSubscriptionId, outcome: result.outcome, reason: result.reason };
    if (result.outcome === 'NOT_AUTHORIZED')
        return { planMigrationSubscriptionId, outcome: result.outcome, reason: result.reason };
    if (result.outcome === 'APPLIED_CARD')
        return {
            planMigrationSubscriptionId,
            outcome: result.outcome,
            escalated: result.escalated
        };
    return { planMigrationSubscriptionId, outcome: result.outcome };
}

function shiftLocalDay(day: string, days: number): string {
    const [year, month, date] = day.split('-').map(Number);
    const instant = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (date ?? 1) + days));
    return `${instant.getUTCFullYear().toString().padStart(4, '0')}-${(instant.getUTCMonth() + 1)
        .toString()
        .padStart(2, '0')}-${instant.getUTCDate().toString().padStart(2, '0')}`;
}
