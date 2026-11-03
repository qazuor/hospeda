import { and, eq, getTableColumns, isNotNull, isNull, sql, sum } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    RECONCILIATION_SWEEP_OUTCOMES,
    type ReconciliationSweepOutcome,
    reconciliationSweepRuns,
    type SelectReconciliationSweepRun
} from '../../schemas/vertical/reconciliation-sweep-run.dbschema.ts';
import { subscriptions } from '../../schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { closeRunIfOpen, extendRunLease } from '../../utils/run-lease.ts';

export type { ReconciliationSweepOutcome };
/** Terminal outcomes permitted for a reconciliation slice. */
export { RECONCILIATION_SWEEP_OUTCOMES };

const runLease = {
    table: reconciliationSweepRuns,
    id: reconciliationSweepRuns.id,
    leaseUntil: reconciliationSweepRuns.leaseUntil,
    outcome: reconciliationSweepRuns.outcome
};

/** Input for opening one sweep run. */
export interface OpenReconciliationSweepRunInput {
    readonly correlationId: string;
    readonly startedAt: Date;
    readonly tx?: DrizzleClient;
}

/** Input for closing one still-open sweep run. */
export interface CloseReconciliationSweepRunInput {
    readonly id: string;
    readonly finishedAt: Date;
    readonly rowsRead: number;
    readonly rowsFailed: number;
    readonly tx?: DrizzleClient;
}

/** Input for finding a sweep run by identity. */
export interface FindReconciliationSweepRunInput {
    readonly id: string;
    readonly tx?: DrizzleClient;
}

/** Input for opening a cycle's first or next slice. */
export interface OpenReconciliationSweepSliceInput {
    readonly correlationId: string;
    readonly cycleId?: string;
    readonly ttlMs?: number;
    readonly tx?: DrizzleClient;
}

/** Database counter increments persisted with each row stamp or pass heartbeat. */
export interface ReconciliationSweepCounters {
    readonly rowsRead?: number;
    readonly rowsFailed?: number;
}

/** Terminal state and progress fields persisted when a slice closes. */
export interface CloseReconciliationSweepSliceInput extends ReconciliationSweepCounters {
    readonly id: string;
    readonly outcome: ReconciliationSweepOutcome;
    readonly phase: string;
    readonly rowsComplete: boolean;
    readonly passesCompleted: readonly string[];
    readonly failedSubscriptionIds: readonly string[];
    readonly tx?: DrizzleClient;
}

/** Read-only registry of sweep run boundaries and outcomes. */
export class ReconciliationSweepRunModel {
    /** Inserts and returns an open run; the caller supplies the injected-clock instant. */
    async open(input: OpenReconciliationSweepRunInput): Promise<SelectReconciliationSweepRun> {
        const db = input.tx ?? getDb();
        const [row] = await db
            .insert(reconciliationSweepRuns)
            .values({ correlationId: input.correlationId, startedAt: input.startedAt })
            .returning();
        if (!row) throw new Error('Reconciliation sweep run insert returned no row');
        return row;
    }

    /** Closes only an open run and returns null if it is already closed or missing. */
    async close(
        input: CloseReconciliationSweepRunInput
    ): Promise<SelectReconciliationSweepRun | null> {
        const db = input.tx ?? getDb();
        const [row] = await db
            .update(reconciliationSweepRuns)
            .set({
                finishedAt: input.finishedAt,
                rowsRead: input.rowsRead,
                rowsFailed: input.rowsFailed
            })
            .where(
                and(
                    eq(reconciliationSweepRuns.id, input.id),
                    isNull(reconciliationSweepRuns.finishedAt)
                )
            )
            .returning();
        return row ?? null;
    }

    /** Finds one run by id, or null when it does not exist. */
    async findById(
        input: FindReconciliationSweepRunInput
    ): Promise<SelectReconciliationSweepRun | null> {
        const db = input.tx ?? getDb();
        const [row] = await db
            .select()
            .from(reconciliationSweepRuns)
            .where(eq(reconciliationSweepRuns.id, input.id))
            .limit(1);
        return row ?? null;
    }

    /** Opens slice zero or copies the cycle anchor into its next slice using database time. */
    async openSlice(
        input: OpenReconciliationSweepSliceInput
    ): Promise<SelectReconciliationSweepRun> {
        const db = input.tx ?? getDb();
        const id = crypto.randomUUID();
        const previous = input.cycleId
            ? await db
                  .select()
                  .from(reconciliationSweepRuns)
                  .where(eq(reconciliationSweepRuns.cycleId, input.cycleId))
                  .orderBy(sql`${reconciliationSweepRuns.sliceIndex} DESC`)
                  .limit(1)
            : [];
        const prior = previous[0];
        const cycleId = prior?.cycleId ?? id;
        const [row] = await db
            .insert(reconciliationSweepRuns)
            .values({
                id,
                correlationId: input.correlationId,
                startedAt: sql`now()`,
                cycleId,
                cycleDate:
                    prior?.cycleDate ??
                    sql`(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`,
                cycleStartedAt: prior?.cycleStartedAt ?? sql`now()`,
                sliceIndex: prior ? (prior.sliceIndex ?? 0) + 1 : 0,
                phase: 'ROWS',
                rowsComplete: false,
                passesCompleted: prior?.passesCompleted ?? [],
                leaseUntil: sql`now() + (${input.ttlMs ?? 300_000} * interval '1 millisecond')`
            })
            .returning();
        if (!row) throw new Error('Reconciliation sweep slice insert returned no row');
        return row;
    }

    /** Finds open slices with SQL-computed lease liveness. */
    async findOpenRunsWithLease(input: { readonly tx?: DrizzleClient } = {}) {
        const db = input.tx ?? getDb();
        return db
            .select({
                ...getTableColumns(reconciliationSweepRuns),
                leaseLive: sql<boolean>`COALESCE(${reconciliationSweepRuns.leaseUntil} > now(), false)`
            })
            .from(reconciliationSweepRuns)
            .where(
                and(
                    isNull(reconciliationSweepRuns.outcome),
                    isNotNull(reconciliationSweepRuns.cycleId)
                )
            );
    }

    /** Closes one abandoned open slice with database time. */
    async closeAbandoned(input: { readonly id: string; readonly tx?: DrizzleClient }) {
        return closeRunIfOpen({
            lease: runLease,
            id: input.id,
            outcome: 'ABANDONED',
            set: { finishedAt: sql`now()` },
            tx: input.tx
        });
    }

    /** Closes a slice once and persists its final progress using database time. */
    async closeSlice(
        input: CloseReconciliationSweepSliceInput
    ): Promise<SelectReconciliationSweepRun | null> {
        const db = input.tx ?? getDb();
        const [row] = await db
            .update(reconciliationSweepRuns)
            .set({
                outcome: input.outcome,
                phase: input.phase,
                rowsComplete: input.rowsComplete,
                passesCompleted: [...input.passesCompleted],
                failedSubscriptionIds: [...input.failedSubscriptionIds],
                rowsRead: input.rowsRead,
                rowsFailed: input.rowsFailed,
                finishedAt: sql`now()`
            })
            .where(
                and(
                    eq(reconciliationSweepRuns.id, input.id),
                    isNull(reconciliationSweepRuns.outcome)
                )
            )
            .returning();
        return row ?? null;
    }

    /** Finds today's newest cycle and returns every slice that belongs to it. */
    async findLatestCycleOfToday(input: { readonly tx?: DrizzleClient } = {}) {
        const db = input.tx ?? getDb();
        const latest = await db
            .select({ cycleId: reconciliationSweepRuns.cycleId })
            .from(reconciliationSweepRuns)
            .where(
                sql`${reconciliationSweepRuns.cycleDate} = (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`
            )
            .orderBy(sql`${reconciliationSweepRuns.cycleStartedAt} DESC`)
            .limit(1);
        const cycleId = latest[0]?.cycleId;
        if (!cycleId) return null;
        const slices = await db
            .select()
            .from(reconciliationSweepRuns)
            .where(eq(reconciliationSweepRuns.cycleId, cycleId))
            .orderBy(reconciliationSweepRuns.sliceIndex);
        return { cycleId, slices };
    }

    /** Stamps one completed row only after extending its still-open slice lease atomically. */
    async stampSweptRow(input: {
        readonly runId: string;
        readonly subscriptionId: string;
        readonly counters: ReconciliationSweepCounters;
        readonly tx?: DrizzleClient;
    }): Promise<{ readonly stamped: boolean }> {
        const db = input.tx ?? getDb();
        return db.transaction(async (transaction) => {
            const tx = transaction as unknown as DrizzleClient;
            const extended = await extendRunLease({
                lease: runLease,
                id: input.runId,
                set: {
                    rowsRead: sql`${reconciliationSweepRuns.rowsRead} + ${input.counters.rowsRead ?? 1}`,
                    rowsFailed: sql`${reconciliationSweepRuns.rowsFailed} + ${input.counters.rowsFailed ?? 0}`
                },
                tx
            });
            if (!extended) return { stamped: false };
            await tx
                .update(subscriptions)
                .set({ lastSweptAt: sql`now()` })
                .where(eq(subscriptions.id, input.subscriptionId));
            return { stamped: true };
        });
    }

    /** Sums the per-slice row counters for one cycle. */
    async sumCycle(input: { readonly cycleId: string; readonly tx?: DrizzleClient }) {
        const db = input.tx ?? getDb();
        const [totals] = await db
            .select({
                slices: sql<number>`count(*)::int`,
                rowsRead: sum(reconciliationSweepRuns.rowsRead),
                rowsFailed: sum(reconciliationSweepRuns.rowsFailed),
                failedSubscriptionIds: sql<
                    string[]
                >`COALESCE((SELECT array_agg(DISTINCT failed_id) FROM ${reconciliationSweepRuns} AS slices CROSS JOIN LATERAL unnest(slices.failed_subscription_ids) failed_id WHERE slices.cycle_id = ${input.cycleId}), ARRAY[]::uuid[])`
            })
            .from(reconciliationSweepRuns)
            .where(eq(reconciliationSweepRuns.cycleId, input.cycleId));
        return totals;
    }
}

/**
 * «una corrida es completa si tiene fin y ninguna fila fallida» (B11.md:1142-1188).
 * @param input.finishedAt - The recorded end instant, or null while open.
 * @param input.rowsFailed - Number of failed inventory rows.
 * @returns Whether the run completed every row without failure.
 */
export function isReconciliationSweepRunComplete(input: {
    readonly finishedAt: Date | null;
    readonly rowsFailed: number;
}): boolean {
    return input.finishedAt !== null && input.rowsFailed === 0;
}

/** Shared reconciliation sweep run persistence model. */
export const reconciliationSweepRunModel = new ReconciliationSweepRunModel();
