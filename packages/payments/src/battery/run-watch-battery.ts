/**
 * The engine of the provider watch battery (HOS-1512, AC:B1:15, AC:B1:20).
 *
 * It runs the catalog's measurements against one account, applies both guards,
 * compares what it read with the fake's expected value and the shape of every response
 * with the previous run's, writes the run, and reports what changed. It never adjusts
 * anything and it never reports green over a run that measured nothing.
 *
 * Ports only: the transport, the clock, the previous shapes and the run record come in
 * from the caller, so this module knows no database, no cron and no mailer.
 *
 * @module battery/run-watch-battery
 */
import type { Clock } from '@repo/billing-verticals-contract';
import { diffShapes, jsonEqual, shapeOf } from './shape';
import {
    type JsonValue,
    type MeasurementShapes,
    type ShapeMap,
    type WatchAccount,
    type WatchAlert,
    type WatchAuthorization,
    type WatchContext,
    type WatchEntry,
    WatchGuardError,
    type WatchMeasurementRecord,
    type WatchRunOutcome,
    type WatchRunRecord,
    type WatchShapeBaseline,
    type WatchTransport
} from './types';
import { validateWatchCatalog } from './watch-catalog';
import { chargeStatedByRequest, isMoneyWrite } from './watch-charge';
import {
    assertAccountMatches,
    assertBudgetMatches,
    assertProductionAuthorized
} from './watch-guards';

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
    /** Shapes of the previous completed run of this account; `null` when there is none yet. */
    readonly readPreviousShapes: (args: {
        readonly account: WatchAccount;
    }) => Promise<WatchShapeBaseline | null>;
    /** Writes the run. It is part of the run: when it rejects, the run rejects. */
    readonly recordRun: (args: { readonly run: WatchRunRecord }) => Promise<void>;
}

/** What {@link runWatchBattery} returns. */
export interface RunWatchBatteryResult {
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

function buildContext(args: {
    readonly entry: WatchEntry;
    readonly transport: WatchTransport;
    readonly shapes: Record<string, ShapeMap>;
}): WatchContext {
    const { entry, transport, shapes } = args;
    let chargedMinor = 0;
    return {
        send: async ({ label, request, chargeMinor }) => {
            if (entry.effect === 'read' && request.method !== 'GET') {
                throw new WatchGuardError({
                    code: 'READ_ENTRY_MUTATED',
                    message: `${entry.id} is declared read-only and tried a ${request.method}`
                });
            }
            if (
                request.method !== 'GET' &&
                isMoneyWrite({ request }) &&
                entry.effect !== 'moves-money'
            ) {
                throw new WatchGuardError({
                    code: 'MONEY_ROUTE_FORBIDDEN',
                    message: `${entry.id} is not marked moves-money and tried a ${request.method} to ${request.path}`
                });
            }
            if (entry.effect === 'moves-money' && request.method !== 'GET') {
                if (chargeMinor === undefined) {
                    throw new WatchGuardError({
                        code: 'CHARGE_UNDECLARED',
                        message: `${entry.id} sent a ${request.method} to ${request.path} without declaring what it charges`
                    });
                }
                const stated = chargeStatedByRequest({ request });
                if (stated !== chargeMinor) {
                    throw new WatchGuardError({
                        code: 'CHARGE_MISMATCH',
                        message: `${entry.id} declared a charge of ${chargeMinor} and the request body states ${stated} (minor units)`
                    });
                }
            }
            if (chargeMinor !== undefined) {
                chargedMinor += chargeMinor;
                if (entry.effect !== 'moves-money' || chargedMinor > (entry.maxChargeMinor ?? 0)) {
                    throw new WatchGuardError({
                        code: 'BUDGET_EXCEEDED',
                        message: `${entry.id} would charge ${chargedMinor}, above what it declared`
                    });
                }
            }
            const response = await transport(request);
            shapes[label] = shapeOf({ body: response.body });
            return response;
        }
    };
}

function shapeAlerts(args: {
    readonly id: string;
    readonly previous: MeasurementShapes | undefined;
    readonly current: MeasurementShapes;
}): readonly WatchAlert[] {
    if (args.previous === undefined) return [];
    const alerts: WatchAlert[] = [];
    for (const [label, previousShape] of Object.entries(args.previous)) {
        const currentShape = args.current[label];
        if (currentShape === undefined) continue;
        const details = diffShapes({ previous: previousShape, current: currentShape });
        if (details.length > 0) {
            alerts.push({
                measurementId: args.id,
                kind: 'shape_changed',
                label,
                expected: previousShape,
                obtained: currentShape,
                details
            });
        }
    }
    return alerts;
}

async function measureEntry(args: {
    readonly entry: WatchEntry;
    readonly input: RunWatchBatteryInput;
    readonly baseline: WatchShapeBaseline | null;
}): Promise<{ readonly record: WatchMeasurementRecord; readonly alerts: readonly WatchAlert[] }> {
    const { entry, input, baseline } = args;
    // The guards open the measurement: nothing is sent before they pass.
    if (entry.effect === 'moves-money') {
        assertBudgetMatches({ entry, authorization: input.authorization });
    }
    if (entry.effect !== 'read') {
        await assertAccountMatches({ account: input.account, transport: input.transport });
    }
    const shapes: Record<string, ShapeMap> = {};
    let obtained: JsonValue;
    try {
        obtained = await entry.measure(buildContext({ entry, transport: input.transport, shapes }));
    } catch (error) {
        if (error instanceof WatchGuardError) throw error;
        return {
            record: {
                outcome: 'errored',
                expected: entry.expected,
                obtained: null,
                shapes,
                error: describeError(error)
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
            shapes
        },
        alerts
    };
}

/**
 * Runs the battery once against one account and records the run.
 *
 * Sequence: production needs the authorization of the current month before anything is
 * sent; the catalog must be valid and have entries for the account; each measurement opens
 * with its guards; the run (measurements, alerts, outcome) is written before the result is
 * returned, and a write that fails fails the run.
 *
 * A guard that trips ends the run as `aborted`; the measurements already read stay in the
 * record. A measurement that cannot be read ends the run as `failed` after the others ran.
 *
 * @param input - See {@link RunWatchBatteryInput}
 * @returns The recorded run and whether the watchdog may be pinged
 * @throws When reading the previous shapes or writing the run fails
 *
 * @example
 * ```ts
 * const { run, mayPingWatchdog } = await runWatchBattery({
 *   account: 'sandbox', catalog: WATCH_CATALOG, transport, authorization: null,
 *   clock, readPreviousShapes, recordRun
 * });
 * ```
 */
export async function runWatchBattery(input: RunWatchBatteryInput): Promise<RunWatchBatteryResult> {
    const startedAt = input.clock.now();
    const measurements: Record<string, WatchMeasurementRecord> = {};
    const alerts: WatchAlert[] = [];
    let outcome: WatchRunOutcome = 'completed';
    let reason: string | undefined;

    const entries = input.catalog.filter((entry) => entry.accounts.includes(input.account));
    const { problems } = validateWatchCatalog({ catalog: input.catalog });

    try {
        if (input.account === 'production') {
            assertProductionAuthorized({ authorization: input.authorization, now: startedAt });
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

    if (outcome === 'completed') {
        const baseline = await input.readPreviousShapes({ account: input.account });
        for (const entry of entries) {
            try {
                const measured = await measureEntry({ entry, input, baseline });
                measurements[entry.id] = measured.record;
                alerts.push(...measured.alerts);
                if (measured.record.outcome === 'errored' && outcome === 'completed') {
                    outcome = 'failed';
                    reason = `${entry.id} could not be read: ${measured.record.error ?? 'unknown error'}`;
                }
            } catch (error) {
                if (!(error instanceof WatchGuardError)) throw error;
                outcome = 'aborted';
                reason = describeError(error);
                break;
            }
        }
    }

    const run: WatchRunRecord = {
        account: input.account,
        startedAt,
        finishedAt: input.clock.now(),
        outcome,
        ...(reason === undefined ? {} : { reason }),
        measurements,
        alerts
    };
    await input.recordRun({ run });
    return {
        run,
        mayPingWatchdog: outcome === 'completed' && Object.keys(measurements).length > 0
    };
}
