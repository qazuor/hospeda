/**
 * The engine of the provider watch battery (HOS-1512, AC:B1:15, AC:B1:20).
 *
 * It runs the catalog's measurements against one account, applies both guards,
 * compares what it read with the fake's expected value and the shape of every response
 * with the ACCEPTED baseline, writes the run, and reports what changed. It never adjusts
 * anything and it never reports green over a run that measured nothing.
 *
 * Lifecycle: every run is a row from the moment it starts. A production run consumes the
 * owner's authorization atomically with that row (one authorization, one run); everything that
 * can refuse the run (no authorization, wrong month, wrong account id, a bad or empty catalog)
 * is checked BEFORE it starts, so a refusal never burns the authorization.
 *
 * Ports only: the transport, the clock, the baseline and the run record come in from the
 * caller, so this module knows no database, no cron and no mailer.
 *
 * @module battery/run-watch-battery
 */
import type { Clock } from '@repo/billing-verticals-contract';
import { diffMeasurementShapes, jsonEqual } from './shape';
import {
    type JsonValue,
    type MeasurementShapes,
    type ShapeMap,
    type WatchAccount,
    type WatchAlert,
    type WatchAuthorization,
    type WatchEntry,
    WatchGuardError,
    type WatchMeasurementRecord,
    type WatchRunOutcome,
    type WatchRunRecord,
    type WatchShapeBaseline,
    type WatchTransport
} from './types';
import { validateWatchCatalog } from './watch-catalog';
import {
    assertAccountMatches,
    assertAuthorizationCoversMoneyCatalog,
    assertBudgetMatches,
    assertProductionAuthorized
} from './watch-guards';
import { createGuardedSend } from './watch-send';
import { createWatchRunState, type WatchRunState } from './watch-write-guard';

/** What {@link runWatchBattery} needs. */
export interface RunWatchBatteryInput {
    /** The account the run targets. */
    readonly account: WatchAccount;
    /** The measurements. */
    readonly catalog: readonly WatchEntry[];
    /** Sends raw requests to the provider with this account's token. */
    readonly transport: WatchTransport;
    /** The monthly authorization the owner custodies, if one is set. */
    readonly authorization: WatchAuthorization | null;
    readonly clock: Clock;
    /** Cooperative cancellation: no measurement starts once it is aborted. */
    readonly signal?: AbortSignal | undefined;
    /** No measurement starts at or after this instant. */
    readonly deadlineAt?: Date | undefined;
    /**
     * The shapes the owner ACCEPTED for this account; `null` when none was accepted yet. A shape
     * that differs from it alerts on EVERY run until the owner accepts the new one.
     */
    readonly readBaseline: (args: {
        readonly account: WatchAccount;
    }) => Promise<WatchShapeBaseline | null>;
    /**
     * Opens the run's row. For a production run that passed every pre-flight check
     * (`consumeAuthorization` set) it ALSO consumes the authorization, atomically with the
     * insert; `authorizationConsumed` is false when another run consumed it first.
     */
    readonly startRun: (args: {
        readonly account: WatchAccount;
        readonly startedAt: Date;
        readonly consumeAuthorization?: {
            readonly month: string;
            readonly maxChargeMinor: number;
            readonly accountId: string;
        };
    }) => Promise<{ readonly runId: string; readonly authorizationConsumed: boolean }>;
    /**
     * Persists a provider id the moment the write that created it answers, OUTSIDE the closing of
     * the run, so a run that dies or whose closing fails still leaves the ids a human needs to
     * cancel or refund what it created. When it rejects the run aborts: nothing more is sent.
     */
    readonly recordProgress: (args: {
        readonly runId: string;
        readonly measurementId: string;
        readonly providerIds?: readonly string[];
        /** Idempotency keys of writes about to be sent, recorded BEFORE they are. */
        readonly writeKeys?: readonly string[];
        /** The money ledger as it stands, written in the same statement as this record. */
        readonly ledger: { readonly charged: number; readonly refunded: number };
    }) => Promise<void>;
    /** Writes the end of the run. It is part of the run: when it rejects, the run rejects. */
    readonly finishRun: (args: {
        readonly runId: string;
        readonly run: WatchRunRecord;
    }) => Promise<void>;
}

/** What {@link runWatchBattery} returns. */
export interface RunWatchBatteryResult {
    readonly runId: string;
    readonly run: WatchRunRecord;
    /**
     * Whether the run may be reported to the external watchdog: it completed AND measured at
     * least one entry. Only a run that really looked at the provider is allowed to say so.
     */
    readonly mayPingWatchdog: boolean;
}

function describeError(error: unknown): string {
    if (error instanceof WatchGuardError) return `${error.code}: ${error.message}`;
    return error instanceof Error ? error.message : String(error);
}

function shapeAlerts(args: {
    readonly id: string;
    readonly previous: MeasurementShapes | undefined;
    readonly current: MeasurementShapes;
}): readonly WatchAlert[] {
    // No accepted baseline is NEVER silent: it alerts on every run until the owner accepts a shape.
    if (args.previous === undefined) {
        return [
            {
                measurementId: args.id,
                kind: 'shape_baseline_missing',
                expected: null,
                obtained: args.current,
                details: ['no accepted baseline for this measurement: review and accept its shape']
            }
        ];
    }
    return diffMeasurementShapes({ accepted: args.previous, observed: args.current }).map(
        ({ label, details }) => ({
            measurementId: args.id,
            kind: 'shape_changed' as const,
            label,
            expected: args.previous?.[label] ?? {},
            obtained: args.current[label] ?? {},
            details
        })
    );
}

async function measureEntry(args: {
    readonly entry: WatchEntry;
    readonly input: RunWatchBatteryInput;
    readonly baseline: WatchShapeBaseline | null;
    /** Filled while the measurement runs, so a guard that aborts it midway keeps what it saw. */
    readonly sink: { readonly shapes: Record<string, ShapeMap>; readonly providerIds: string[] };
    readonly state: WatchRunState;
    readonly runId: string;
}): Promise<{ readonly record: WatchMeasurementRecord; readonly alerts: readonly WatchAlert[] }> {
    const { entry, input, baseline, sink, state, runId } = args;
    // The guards open the measurement: nothing is sent before they pass.
    if (entry.effect === 'moves-money') {
        assertBudgetMatches({ entry, authorization: input.authorization });
    }
    if (entry.effect !== 'read') {
        await assertAccountMatches({
            account: input.account,
            transport: input.transport,
            expectedAccountId: input.authorization?.accountId
        });
    }
    const { shapes, providerIds } = sink;
    const guarded = createGuardedSend({
        entry,
        transport: input.transport,
        runId,
        state,
        runCap: input.authorization?.maxChargeMinor ?? 0,
        shapes,
        providerIds,
        record: (progress) => input.recordProgress({ runId, measurementId: entry.id, ...progress })
    });
    let obtained: JsonValue = null;
    let failed = false;
    let failure: unknown;
    try {
        obtained = await entry.measure({ send: guarded.send });
    } catch (error) {
        failed = true;
        failure = error;
    }
    // Whatever the measurement did, no send may still be in flight (nor start) when its ids are
    // read and the run is closed: settle first, then decide.
    const guardFailure = await guarded.settle();
    // The guard that tripped FIRST is the cause; a later refusal (e.g. a send after it) is not.
    if (guardFailure !== null) throw guardFailure;
    if (failure instanceof WatchGuardError) throw failure;
    if (failed) {
        return {
            record: {
                outcome: 'errored',
                expected: entry.expected,
                obtained: null,
                shapes,
                providerIds,
                error: describeError(failure)
            },
            alerts: []
        };
    }
    const alerts: WatchAlert[] = [];
    const matches = jsonEqual({ left: obtained, right: entry.expected });
    if (!matches) {
        alerts.push({
            measurementId: entry.id,
            kind: 'value_changed',
            expected: entry.expected,
            obtained,
            details: []
        });
    }
    alerts.push(...shapeAlerts({ id: entry.id, previous: baseline?.[entry.id], current: shapes }));
    return {
        record: {
            outcome: matches ? 'matched' : 'changed',
            expected: entry.expected,
            obtained,
            shapes,
            providerIds
        },
        alerts
    };
}

/** Why no measurement may start now, or `null` when one may. */
function stopReason(input: RunWatchBatteryInput): string | null {
    if (input.signal?.aborted) return 'TIMED_OUT: the run was cancelled before it finished';
    if (input.deadlineAt && input.clock.now().getTime() >= input.deadlineAt.getTime()) {
        return 'TIMED_OUT: the run reached its deadline before it finished';
    }
    return null;
}

/**
 * Runs the battery once against one account and records the run.
 *
 * Sequence: pre-flight (the production authorization of the current month, unconsumed, with
 * its account id; the account the token belongs to; a valid catalog with entries for the
 * account), then the run row opens (consuming the authorization for production), each
 * measurement opens with its guards, and the run is written whole when it ends.
 *
 * A guard that trips ends the run as `aborted`; what was read stays in the record. A
 * measurement that cannot be read, or a run cut short by its signal or deadline, ends as
 * `failed`. No measurement starts once the run is cancelled or past its deadline.
 *
 * @param input - See {@link RunWatchBatteryInput}
 * @returns The recorded run and whether the watchdog may be pinged
 * @throws When reading the baseline, opening the run or writing it fails
 *
 * @example
 * ```ts
 * const { run, mayPingWatchdog } = await runWatchBattery({
 *   account: 'sandbox', catalog: WATCH_CATALOG, transport, authorization: null,
 *   clock, readBaseline, startRun, finishRun
 * });
 * ```
 */
export async function runWatchBattery(input: RunWatchBatteryInput): Promise<RunWatchBatteryResult> {
    const startedAt = input.clock.now();
    const measurements: Record<string, WatchMeasurementRecord> = {};
    const alerts: WatchAlert[] = [];
    /** One state for the whole run: the authorized number caps the SUM of its charges. */
    const state = createWatchRunState();
    let outcome: WatchRunOutcome = 'completed';
    let reason: string | undefined;

    const entries = input.catalog.filter((entry) => entry.accounts.includes(input.account));
    const { problems } = validateWatchCatalog({ catalog: input.catalog });

    // Pre-flight: everything that can refuse the run, before it can burn the authorization.
    try {
        if (input.account === 'production') {
            assertProductionAuthorized({ authorization: input.authorization, now: startedAt });
            if (input.authorization) {
                assertAuthorizationCoversMoneyCatalog({
                    entries,
                    account: input.account,
                    authorization: input.authorization
                });
            }
        }
    } catch (error) {
        outcome = 'refused';
        reason = describeError(error);
    }
    if (outcome === 'completed' && problems.length > 0) {
        outcome = 'failed';
        reason = `Invalid catalog: ${problems.join('; ')}`;
    } else if (outcome === 'completed' && entries.length === 0) {
        outcome = 'failed';
        reason = `The catalog has no measurement for the ${input.account} account: a run that measures nothing is a failure`;
    }
    if (outcome === 'completed' && input.account === 'production') {
        try {
            await assertAccountMatches({
                account: input.account,
                transport: input.transport,
                expectedAccountId: input.authorization?.accountId
            });
        } catch (error) {
            outcome = error instanceof WatchGuardError ? 'aborted' : 'failed';
            reason = describeError(error);
        }
    }

    // Read BEFORE the run starts: an infrastructure error here must not burn the authorization, and
    // must still leave a run row (as failed) so the failure is on record.
    let baseline: WatchShapeBaseline | null = null;
    if (outcome === 'completed') {
        try {
            baseline = await input.readBaseline({ account: input.account });
        } catch (error) {
            outcome = 'failed';
            reason = `BASELINE_UNREADABLE: ${describeError(error)}`;
        }
    }
    const preflightPassed = outcome === 'completed';
    const started = await input.startRun({
        account: input.account,
        startedAt,
        ...(preflightPassed && input.account === 'production' && input.authorization
            ? {
                  // The values the run was PRE-FLIGHTED with: if the owner rewrote the authorization in
                  // the meantime, the consumption matches nothing and the run is refused.
                  consumeAuthorization: {
                      month: input.authorization.month,
                      maxChargeMinor: input.authorization.maxChargeMinor,
                      accountId: input.authorization.accountId ?? ''
                  }
              }
            : {})
    });
    if (preflightPassed && input.account === 'production' && !started.authorizationConsumed) {
        outcome = 'refused';
        reason = 'AUTHORIZATION_CONSUMED: another run consumed the production authorization first';
    }

    if (outcome === 'completed') {
        for (const entry of entries) {
            const stopped = stopReason(input);
            if (stopped !== null) {
                outcome = 'failed';
                reason = stopped;
                break;
            }
            const sink = { shapes: {} as Record<string, ShapeMap>, providerIds: [] as string[] };
            try {
                const measured = await measureEntry({
                    entry,
                    input,
                    baseline,
                    sink,
                    state,
                    runId: started.runId
                });
                measurements[entry.id] = measured.record;
                alerts.push(...measured.alerts);
                if (measured.record.outcome === 'errored' && outcome === 'completed') {
                    outcome = 'failed';
                    reason = `${entry.id} could not be read: ${measured.record.error ?? 'unknown error'}`;
                }
            } catch (error) {
                measurements[entry.id] = {
                    outcome: 'errored',
                    expected: entry.expected,
                    obtained: null,
                    shapes: sink.shapes,
                    providerIds: sink.providerIds,
                    error: describeError(error)
                };
                outcome = error instanceof WatchGuardError ? 'aborted' : 'failed';
                reason = describeError(error);
                break;
            }
        }
    }

    // A run cut short AFTER its last measurement started is still cut short: never `completed`.
    if (outcome === 'completed') {
        const stopped = stopReason(input);
        if (stopped !== null) {
            outcome = 'failed';
            reason = stopped;
        }
    }

    const run: WatchRunRecord = {
        account: input.account,
        startedAt,
        finishedAt: input.clock.now(),
        outcome,
        ...(reason === undefined ? {} : { reason }),
        measurements,
        alerts,
        ledger: { charged: state.ledger.charged, refunded: state.ledger.refunded }
    };
    await input.finishRun({ runId: started.runId, run });
    return {
        runId: started.runId,
        run,
        mayPingWatchdog:
            outcome === 'completed' &&
            Object.keys(measurements).length > 0 &&
            input.signal?.aborted !== true
    };
}
