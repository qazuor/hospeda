import {
    ReconciliationSweepSliceAlreadyOpenError,
    reconciliationSweepRunModel,
    type SelectReconciliationSweepRun
} from '@repo/db';
import type {
    ReconciliationSweepPorts,
    ReconciliationSweepSummary
} from './reconciliation-sweep.types.js';

export function skippedSummary(input: {
    readonly skipped: 'lease_held' | 'cycle_done';
    readonly startedAt: Date;
    readonly finishedAt: Date;
    readonly runId?: string;
    readonly cycleId?: string;
    readonly sliceIndex?: number;
    readonly outcome?: import('@repo/db').ReconciliationSweepOutcome;
}): ReconciliationSweepSummary {
    const cycleId = input.cycleId ?? '';
    return {
        runId: input.runId ?? '',
        complete: true,
        pinged: false,
        stoppedOnBudget: false,
        skippedPasses: [],
        rowsRead: 0,
        rowsFailed: 0,
        divergences: 0,
        marksOpened: 0,
        marksAccumulated: 0,
        failures: [],
        startedAt: input.startedAt,
        finishedAt: input.finishedAt,
        ...(input.outcome ? { outcome: input.outcome } : {}),
        skipped: input.skipped,
        phase: 'DONE',
        rowsComplete: input.skipped === 'cycle_done',
        sliceIndex: input.sliceIndex ?? -1,
        cycleId,
        incomplete: false
    };
}

/**
 * Takes the lease and opens this slice: a live open run means `lease_held`, an expired one is
 * closed as ABANDONED, a finished cycle of today records SKIPPED_CYCLE_DONE.
 */
export async function openCycleSlice(args: {
    readonly correlationId: string;
    readonly newCycle?: boolean;
    readonly startedAt: Date;
    readonly ports: ReconciliationSweepPorts;
}): Promise<
    | {
          readonly run: SelectReconciliationSweepRun;
          readonly summary: undefined;
          readonly orphanedCycle?: ReconciliationSweepSummary['orphanedCycle'];
      }
    | {
          readonly run: SelectReconciliationSweepRun;
          readonly summary: ReconciliationSweepSummary;
          readonly orphanedCycle?: ReconciliationSweepSummary['orphanedCycle'];
      }
> {
    const { correlationId, startedAt, ports } = args;
    const held = (): ReconciliationSweepSummary =>
        skippedSummary({ skipped: 'lease_held', startedAt, finishedAt: ports.clock.now() });
    const none = undefined as never;
    const openRuns = await reconciliationSweepRunModel.findOpenRunsWithLease();
    for (const openRun of openRuns) {
        if (openRun.leaseLive) return { run: none, summary: held() };
        const closed = await reconciliationSweepRunModel.closeAbandoned({
            id: openRun.id as string
        });
        // Renewed between our read and the close: the holder is alive, so we did not take it over.
        if (!closed) return { run: none, summary: held() };
    }
    const todayCycle = await reconciliationSweepRunModel.findLatestCycleOfToday();
    const cycleDone = (todayCycle?.slices ?? []).some(
        (slice) => slice.outcome === 'CYCLE_DONE' && slice.rowsComplete === true
    );
    const orphanedCycleSummary =
        args.newCycle && todayCycle && !cycleDone
            ? await reconciliationSweepRunModel.sumCycle({ cycleId: todayCycle.cycleId })
            : undefined;
    const orphanedCycle =
        orphanedCycleSummary && todayCycle
            ? {
                  cycleId: todayCycle.cycleId,
                  cycleDate: todayCycle.slices[0]?.cycleDate ?? '',
                  slices: orphanedCycleSummary.slices,
                  rowsRead: Number(orphanedCycleSummary.rowsRead ?? 0),
                  rowsFailed: Number(orphanedCycleSummary.rowsFailed ?? 0),
                  failedSubscriptionIds: orphanedCycleSummary.failedSubscriptionIds
              }
            : undefined;
    let run: SelectReconciliationSweepRun;
    try {
        run = await reconciliationSweepRunModel.openSlice({
            correlationId,
            ...(todayCycle && !args.newCycle ? { cycleId: todayCycle.cycleId } : {})
        });
    } catch (error) {
        // The unique index allows one open slice: losing the race means a live holder, before any work.
        if (error instanceof ReconciliationSweepSliceAlreadyOpenError)
            return { run: none, summary: held() };
        throw error;
    }
    if (args.newCycle || !cycleDone)
        return { run, summary: undefined, ...(orphanedCycle ? { orphanedCycle } : {}) };
    await reconciliationSweepRunModel.closeSlice({
        id: run.id,
        outcome: 'SKIPPED_CYCLE_DONE',
        phase: 'DONE',
        rowsComplete: true,
        passesCompleted: run.passesCompleted ?? [],
        failedSubscriptionIds: [],
        rowsRead: 0,
        rowsFailed: 0
    });
    return {
        run,
        summary: skippedSummary({
            skipped: 'cycle_done',
            runId: run.id,
            cycleId: run.cycleId ?? run.id,
            sliceIndex: run.sliceIndex ?? 0,
            startedAt,
            finishedAt: ports.clock.now(),
            outcome: 'SKIPPED_CYCLE_DONE'
        }),
        ...(orphanedCycle ? { orphanedCycle } : {})
    };
}

/**
 * Opens the unsliced `single` run. It carries no cycle id, so the partial unique index of
 * migration 0187 (`cycle_id IS NOT NULL`) does not cover it; the only protection against
 * overlapping a live cycle slice is this check, which refuses while any slice holds a live lease.
 */
export async function openSingleRun(args: {
    readonly correlationId: string;
    readonly startedAt: Date;
    readonly ports: ReconciliationSweepPorts;
}): Promise<
    | {
          readonly run: SelectReconciliationSweepRun;
          readonly summary: undefined;
          readonly orphanedCycle?: undefined;
      }
    | {
          readonly run: SelectReconciliationSweepRun;
          readonly summary: ReconciliationSweepSummary;
          readonly orphanedCycle?: undefined;
      }
> {
    const openRuns = await reconciliationSweepRunModel.findOpenRunsWithLease();
    if (openRuns.some((openRun) => openRun.leaseLive))
        return {
            run: undefined as never,
            summary: skippedSummary({
                skipped: 'lease_held',
                startedAt: args.startedAt,
                finishedAt: args.ports.clock.now()
            })
        };
    const run = await reconciliationSweepRunModel.open({
        correlationId: args.correlationId,
        startedAt: args.startedAt
    });
    return { run, summary: undefined };
}
