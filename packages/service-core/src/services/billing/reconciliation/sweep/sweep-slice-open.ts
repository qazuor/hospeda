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
    | { readonly run: SelectReconciliationSweepRun; readonly summary: undefined }
    | { readonly run: SelectReconciliationSweepRun; readonly summary: ReconciliationSweepSummary }
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
    const todayCycle = args.newCycle
        ? null
        : await reconciliationSweepRunModel.findLatestCycleOfToday();
    const cycleDone = (todayCycle?.slices ?? []).some(
        (slice) => slice.outcome === 'CYCLE_DONE' && slice.rowsComplete === true
    );
    let run: SelectReconciliationSweepRun;
    try {
        run = await reconciliationSweepRunModel.openSlice({
            correlationId,
            ...(todayCycle ? { cycleId: todayCycle.cycleId } : {})
        });
    } catch (error) {
        // The unique index allows one open slice: losing the race means a live holder, before any work.
        if (error instanceof ReconciliationSweepSliceAlreadyOpenError)
            return { run: none, summary: held() };
        throw error;
    }
    if (!cycleDone) return { run, summary: undefined };
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
        })
    };
}
