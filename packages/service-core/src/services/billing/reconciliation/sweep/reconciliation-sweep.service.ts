import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import {
    extendRunLease,
    isReconciliationSweepRunComplete,
    ReconciliationSweepSliceAlreadyOpenError,
    reconciliationInventoryModel,
    reconciliationSweepRunModel,
    reconciliationSweepRuns
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, runWithProviderReadScope } from '@repo/payments';
import { noCancellationSeenAnnotation } from '../../subscription/subscription-billing-ports.js';
import { observeAuthorizationRead } from './cancellation-observation.js';
import { createOurCancellationRetryTally, retryOurCancellation } from './our-cancellation-retry.js';
import type { ReconciliationComparisonInput } from './reconciliation-divergence.js';
import { recordDivergence } from './reconciliation-divergence.js';
import type {
    ReconciliationRowCheck,
    ReconciliationSweepFailure,
    ReconciliationSweepInput,
    ReconciliationSweepPass,
    ReconciliationSweepPorts,
    ReconciliationSweepSummary
} from './reconciliation-sweep.types.js';
import { SweepLeaseLostError, SweepTimedOutError } from './sweep-control.js';
import { runSweepPostLoop, type SweepPostLoopResult } from './sweep-post-loop.js';

export type {
    ReconciliationRowCheck,
    ReconciliationRowCheckResult,
    ReconciliationSweepFailure,
    ReconciliationSweepInput,
    ReconciliationSweepPass,
    ReconciliationSweepPorts,
    ReconciliationSweepSummary
} from './reconciliation-sweep.types.js';

const logger = createLogger('billing-reconciliation-sweep');

/** Runs a row's checks in order; a handled S6 decision prevents stale checks from mutating it. */
export async function runReconciliationRowChecks(
    input: ReconciliationComparisonInput,
    checks: readonly ReconciliationRowCheck[]
): Promise<void> {
    for (const check of checks) {
        if ((await check(input)) === 'STOP_REMAINING_CHECKS') return;
    }
}

export { SweepLeaseLostError };

/** Time reserved for the seven post-row passes in the final scheduled slot. */
export const SWEEP_PASS_RESERVE_MS = 15 * 60_000;

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function isBudgetReached(deadlineAt: Date | undefined, clock: Clock): boolean {
    return deadlineAt !== undefined && clock.now().getTime() >= deadlineAt.getTime();
}

function skippedSummary(input: {
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
        outcome: input.outcome ?? 'TIMED_OUT',
        skipped: input.skipped,
        phase: 'DONE',
        rowsComplete: input.skipped === 'cycle_done',
        sliceIndex: input.sliceIndex ?? -1,
        cycleId,
        incomplete: false
    };
}

export async function runReconciliationSweep(
    input: ReconciliationSweepInput = {},
    ports: ReconciliationSweepPorts
): Promise<ReconciliationSweepSummary> {
    const pageSize = input.pageSize ?? 100;
    const correlationId = input.correlationId ?? randomUUID();
    const startedAt = ports.clock.now();
    // The budget is wall time; the injected clock drives the row's act (it may be faked ahead).
    const budgetClock: Clock = input.budgetClock ? { now: input.budgetClock } : ports.clock;
    const openRuns = await reconciliationSweepRunModel.findOpenRunsWithLease();
    for (const openRun of openRuns) {
        if (openRun.leaseLive) {
            return skippedSummary({
                skipped: 'lease_held',
                startedAt,
                finishedAt: ports.clock.now()
            });
        }
        await reconciliationSweepRunModel.closeAbandoned({ id: openRun.id as string });
    }
    const todayCycle = input.newCycle
        ? null
        : await reconciliationSweepRunModel.findLatestCycleOfToday();
    const previousSlices = todayCycle?.slices ?? [];
    const cycleDone = previousSlices.some(
        (slice) => slice.outcome === 'CYCLE_DONE' && slice.rowsComplete === true
    );
    let run: Awaited<ReturnType<typeof reconciliationSweepRunModel.openSlice>>;
    try {
        run = await reconciliationSweepRunModel.openSlice({
            correlationId,
            ...(todayCycle ? { cycleId: todayCycle.cycleId } : {})
        });
    } catch (error) {
        // The unique index allows one open slice: losing the race means a live holder, before any work.
        if (error instanceof ReconciliationSweepSliceAlreadyOpenError)
            return skippedSummary({
                skipped: 'lease_held',
                startedAt,
                finishedAt: ports.clock.now()
            });
        throw error;
    }
    const cycleId = run.cycleId ?? run.id;
    const sliceIndex = run.sliceIndex ?? 0;
    if (cycleDone) {
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
        const finishedAt = ports.clock.now();
        return skippedSummary({
            skipped: 'cycle_done',
            runId: run.id,
            cycleId,
            sliceIndex,
            startedAt,
            finishedAt,
            outcome: 'SKIPPED_CYCLE_DONE'
        });
    }
    const failures: ReconciliationSweepFailure[] = [];
    let rowsRead = 0;
    let rowsFailed = 0;
    let divergences = 0;
    let marksOpened = 0;
    let marksAccumulated = 0;
    const comparisons = ports.comparisons ?? [];
    const compareRow = async (comparisonInput: ReconciliationComparisonInput) => {
        for (const comparison of comparisons) {
            const found = await comparison(comparisonInput);
            for (const divergence of found) {
                divergences++;
                const recorded = await recordDivergence(
                    {
                        subscriptionId: comparisonInput.subscription.id,
                        divergence,
                        correlationId
                    },
                    ports.markPayments ? { markPayments: ports.markPayments } : {}
                );
                if (recorded.markOutcome === 'OPENED') marksOpened++;
                else marksAccumulated++;
            }
        }
    };
    let afterSubscriptionId: string | undefined;
    let stoppedOnBudget = false;
    let passReserveReached = false;
    let rowsComplete = false;
    let phase: 'ROWS' | 'PASSES' | 'DONE' = 'ROWS';
    const failedSubscriptionIds: string[] = [];
    const passesCompleted = [...(run.passesCompleted ?? [])];
    const lease = {
        table: reconciliationSweepRuns,
        id: reconciliationSweepRuns.id,
        leaseUntil: reconciliationSweepRuns.leaseUntil,
        outcome: reconciliationSweepRuns.outcome
    };
    const heartbeat = async (): Promise<void> => {
        const ok = await extendRunLease({
            lease,
            id: run.id
        });
        if (!ok) throw new SweepLeaseLostError();
        if (input.signal?.aborted || isBudgetReached(input.deadlineAt, budgetClock))
            throw new SweepTimedOutError();
    };
    const completePass = async (pass: ReconciliationSweepPass): Promise<void> => {
        if (passesCompleted.includes(pass)) return;
        const next = [...passesCompleted, pass];
        const ok = await extendRunLease({
            lease,
            id: run.id,
            set: { passesCompleted: next }
        });
        if (!ok) throw new SweepLeaseLostError();
        passesCompleted.push(pass);
    };
    const retryPorts = ports.cancellationRetry
        ? {
              provider: ports.provider,
              clock: ports.clock,
              beforeCancelNotice: ports.cancellationRetry.beforeCancelNotice,
              markPayments: ports.markPayments,
              cancellationSeen: ports.cancellationSeen
          }
        : undefined;
    const retryTally = createOurCancellationRetryTally();
    let postLoop: SweepPostLoopResult = {
        stoppedOnBudget: false,
        skippedPasses: [],
        rowsRead: 0,
        rowsFailed: 0,
        failures: [],
        failedSubscriptionIds: []
    };

    /** Fail-closed result when another slice closed this one: counts and failures are kept. */
    const leaseLostSummary = async (): Promise<ReconciliationSweepSummary> => {
        const lostRowsRead = rowsRead + postLoop.rowsRead;
        const lostRowsFailed = rowsFailed + postLoop.rowsFailed;
        const lostFailedIds = [...failedSubscriptionIds, ...postLoop.failedSubscriptionIds];
        await reconciliationSweepRunModel.recordLostSliceProgress({
            id: run.id,
            rowsRead: lostRowsRead,
            rowsFailed: lostRowsFailed,
            failedSubscriptionIds: lostFailedIds
        });
        return {
            ...skippedSummary({
                skipped: 'lease_held',
                runId: run.id,
                cycleId,
                sliceIndex,
                startedAt,
                finishedAt: ports.clock.now(),
                outcome: 'ABANDONED'
            }),
            skipped: undefined,
            leaseLost: true,
            complete: false,
            phase,
            rowsComplete,
            rowsRead: lostRowsRead,
            rowsFailed: lostRowsFailed,
            failures: [...failures, ...postLoop.failures],
            incomplete: true
        };
    };

    try {
        for (;;) {
            const page = await reconciliationInventoryModel.listSweepInventoryPage({
                ...(cycleId ? { cycleId } : { afterSubscriptionId }),
                limit: pageSize
            });
            if (page.length === 0) {
                rowsComplete = true;
                break;
            }
            for (const { subscription, providerLink } of page) {
                if (input.signal?.aborted || isBudgetReached(input.deadlineAt, budgetClock)) {
                    stoppedOnBudget = true;
                    break;
                }
                if (
                    input.lastSlot &&
                    input.deadlineAt !== undefined &&
                    input.deadlineAt.getTime() - budgetClock.now().getTime() < SWEEP_PASS_RESERVE_MS
                ) {
                    passReserveReached = true;
                    break;
                }
                let rowFailed = false;
                let rowRead = false;
                try {
                    await runWithProviderReadScope({
                        fn: async () => {
                            const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
                            actStartInstant({ act });
                            const read = await ports.provider.readAuthorization({
                                authorizationId: providerLink.providerId
                            });
                            rowRead = true;
                            await observeAuthorizationRead({
                                read,
                                act,
                                subscriptionId: subscription.id,
                                annotator: ports.cancellationSeen ?? noCancellationSeenAnnotation,
                                previouslySeenAt: providerLink.cancelledSeenAt
                            });
                            rowsRead++;
                            await compareRow({ subscription, providerLink, read, act });
                            await runReconciliationRowChecks(
                                { subscription, providerLink, read, act },
                                ports.rowChecks ?? []
                            );
                            // A live CANCEL_SCHEDULED left by S11 is retried here, with this loop's read (I8).
                            if (retryPorts && subscription.status === 'CANCEL_SCHEDULED') {
                                const decision =
                                    await reconciliationInventoryModel.findCancellationDecision({
                                        subscriptionId: subscription.id
                                    });
                                if (decision) {
                                    const retried = await retryOurCancellation(
                                        {
                                            subscription,
                                            providerLink,
                                            decision,
                                            correlationId,
                                            prior: { read, act }
                                        },
                                        retryPorts
                                    );
                                    retryTally.add(retried.outcome);
                                }
                            }
                        }
                    });
                } catch (error) {
                    rowsFailed++;
                    rowFailed = true;
                    failedSubscriptionIds.push(subscription.id);
                    const message = errorMessage(error);
                    failures.push({ subscriptionId: subscription.id, message });
                    logger.error(
                        { subscriptionId: subscription.id, error: message },
                        'Reconciliation row failed'
                    );
                }
                const stamped = await reconciliationSweepRunModel.stampSweptRow({
                    runId: run.id,
                    subscriptionId: subscription.id,
                    counters: { rowsRead: rowRead ? 1 : 0, rowsFailed: rowFailed ? 1 : 0 }
                });
                if (!stamped.stamped) throw new SweepLeaseLostError();
            }
            if (input.signal?.aborted) stoppedOnBudget = true;
            if (stoppedOnBudget || passReserveReached) break;
            await heartbeat();
        }

        phase = 'PASSES';
        postLoop = await runSweepPostLoop({
            correlationId,
            pageSize,
            signal: input.signal,
            deadlineAt: input.deadlineAt,
            budgetClock,
            clock: ports.clock,
            provider: ports.provider,
            ports,
            retryPorts,
            comparisons,
            compareRow,
            completed: passesCompleted,
            heartbeat,
            completePass,
            retryTally
        });
    } catch (error) {
        if (error instanceof SweepLeaseLostError) return await leaseLostSummary();
        if (error instanceof SweepTimedOutError) {
            stoppedOnBudget = true;
        } else {
            await reconciliationSweepRunModel.closeSlice({
                id: run.id,
                outcome: 'FAILED',
                phase,
                rowsComplete,
                passesCompleted,
                failedSubscriptionIds,
                rowsRead,
                rowsFailed
            });
            throw error;
        }
    }
    stoppedOnBudget ||= postLoop.stoppedOnBudget;
    rowsRead += postLoop.rowsRead;
    rowsFailed += postLoop.rowsFailed;
    failures.push(...postLoop.failures);
    failedSubscriptionIds.push(...postLoop.failedSubscriptionIds);

    const finishedAt = ports.clock.now();
    const outcome = stoppedOnBudget ? 'TIMED_OUT' : 'CYCLE_DONE';
    phase = stoppedOnBudget ? phase : 'DONE';
    const closedRun = await reconciliationSweepRunModel.closeSlice({
        id: run.id,
        outcome,
        phase,
        rowsComplete,
        passesCompleted,
        failedSubscriptionIds,
        rowsRead,
        rowsFailed
    });
    if (!closedRun) return await leaseLostSummary();
    const complete =
        !stoppedOnBudget &&
        rowsComplete &&
        isReconciliationSweepRunComplete({ finishedAt, rowsFailed });
    const cycleSummary =
        outcome === 'CYCLE_DONE'
            ? await reconciliationSweepRunModel.sumCycle({ cycleId })
            : undefined;
    const cycle = cycleSummary
        ? {
              cycleId,
              cycleDate: run.cycleDate ?? '',
              slices: cycleSummary.slices,
              rowsRead: Number(cycleSummary.rowsRead ?? 0),
              rowsFailed: Number(cycleSummary.rowsFailed ?? 0),
              failedSubscriptionIds: cycleSummary.failedSubscriptionIds
          }
        : undefined;
    const cycleCanPing =
        outcome === 'CYCLE_DONE' && rowsComplete && Number(cycleSummary?.rowsFailed ?? 0) === 0;
    let pinged = false;
    if (cycleCanPing && ports.livenessPing) {
        try {
            await ports.livenessPing.ping({ sweep: 'RECONCILIATION', runId: run.id, finishedAt });
            pinged = true;
        } catch (error) {
            logger.error(
                { runId: run.id, error: errorMessage(error) },
                'Reconciliation sweep ping failed'
            );
        }
    }

    return {
        runId: run.id,
        complete,
        pinged,
        stoppedOnBudget,
        skippedPasses: postLoop.skippedPasses,
        rowsRead,
        rowsFailed,
        divergences,
        marksOpened,
        marksAccumulated,
        failures,
        startedAt,
        finishedAt,
        ...(postLoop.zeroCallChecks ? { zeroCallChecks: postLoop.zeroCallChecks } : {}),
        ...(postLoop.cancellationRetry ? { cancellationRetry: postLoop.cancellationRetry } : {}),
        ...(postLoop.terminalReturn ? { terminalReturn: postLoop.terminalReturn } : {}),
        ...(postLoop.creditedPayments ? { creditedPayments: postLoop.creditedPayments } : {}),
        ...(postLoop.paidOrders ? { paidOrders: postLoop.paidOrders } : {}),
        ...(postLoop.markEscalation ? { markEscalation: postLoop.markEscalation } : {}),
        ...(postLoop.pauseGifts ? { pauseGifts: postLoop.pauseGifts } : {}),
        outcome,
        phase,
        rowsComplete,
        sliceIndex,
        cycleId,
        ...(cycle ? { cycle } : {}),
        incomplete: input.lastSlot === true && (outcome !== 'CYCLE_DONE' || !rowsComplete)
    };
}
