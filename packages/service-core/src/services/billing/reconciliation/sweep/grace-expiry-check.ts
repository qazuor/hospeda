import { randomUUID } from 'node:crypto';
import { reconciliationMarkModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant } from '@repo/payments';
import {
    type RecordChargeFactPorts,
    type RecordChargeFactResult,
    recordChargeFact
} from '../../payment/record-charge-fact.service.js';
import {
    type SuspendForArrearsPorts,
    suspendForArrears
} from '../../subscription/suspend-for-arrears.service.js';
import { openReconciliationMark } from '../open-reconciliation-mark.service.js';
import { readPeriodCharges } from '../period-charges/read-period-charges.js';
import type { ReconciliationRowCheck } from './reconciliation-sweep.service.js';
import {
    loggedUnresolvedPeriodCharges,
    type UnresolvedPeriodCharges
} from './unresolved-period-charge.port.js';

const logger = createLogger('billing-grace-expiry-check');

/** One day in epoch milliseconds (`check:local-date-math`: no local calendar math). */
const DAY_MS = 86_400_000;
/** "Still unknown" more than this long after the record started is notified (`B/09` §6.2). */
const NOTIFY_AFTER_MS = DAY_MS;
/** "Still unknown" this long after the record started opens reason 21 (`B/09` §6.2). */
const MARK_AFTER_MS = 3 * DAY_MS;

/** Ports of {@link settleChargedPeriod}: `recordChargeFact`'s, minus the actor the sweep fixes. */
export type SettleChargedPeriodPorts = Omit<RecordChargeFactPorts, 'actorType'>;

/**
 * Ports of the grace expiry check: S6's, the ones `recordChargeFact` needs to
 * settle a charged period (P1 + S5), and the DEC-OBS-001 channel.
 */
export type GraceExpiryCheckPorts = SuspendForArrearsPorts &
    SettleChargedPeriodPorts & {
        /** The DEC-OBS-001 channel (B11/B13a); defaults to a structured warning. */
        readonly unresolvedPeriodCharges?: UnresolvedPeriodCharges;
    };

/**
 * The S6 occurrence of an expired grace clock: one per clock, so a retry of the
 * same expiry looks at the notice already enqueued and a later grace gets its own.
 *
 * @param input.subscriptionId - The row whose clock expired
 * @param input.graceEndsAt - The instant the clock ran out
 * @returns The occurrence id used as the before-cancel notice's dedup occurrence
 */
export function graceExpiredOccurrenceId(input: {
    readonly subscriptionId: string;
    readonly graceEndsAt: Date;
}): string {
    return `${input.subscriptionId}:grace-expired:${input.graceEndsAt.toISOString()}`;
}

/**
 * Settles a period the `B/09` §4 read showed as charged (AC:B7:8, the "re-read
 * of S6" half of AC:B7:6; D-2): re-reads the charge by id, creates its `payment`
 * if missing and runs P1, through `recordChargeFact` with the sweep as the actor
 * (I-14). It never looks at the row's state: on a `GRACE_PERIOD` card principal
 * `recordChargeFact` runs S5 (still bound to the unpaid period), on an `ACTIVE`
 * row it only credits. A failure propagates: S5 does not happen in this run.
 *
 * @param input.chargeId - The approved charge record of the period
 * @param ports - `recordChargeFact`'s ports
 * @returns What `recordChargeFact` did
 */
export async function settleChargedPeriod(
    input: { readonly chargeId: string },
    ports: SettleChargedPeriodPorts
): Promise<RecordChargeFactResult> {
    return recordChargeFact({ chargeId: input.chargeId }, { ...ports, actorType: 'job' });
}

/**
 * Whether the row has an open reason 21 `COBRO_DEL_PERIODO_SIN_RESOLVER`: while
 * it does, S6 does not run (`B/09` §6.2) until a person resolves it by S15.
 *
 * @param input.subscriptionId - The row in grace
 * @returns True when reason 21 is open on it
 */
async function hasOpenUnresolvedPeriodChargeMark(input: {
    readonly subscriptionId: string;
}): Promise<boolean> {
    const mark = await reconciliationMarkModel.findOpen({
        subject: { kind: 'SUBSCRIPTION', subscriptionId: input.subscriptionId },
        reason: 'COBRO_DEL_PERIODO_SIN_RESOLVER'
    });
    return mark !== null;
}

/**
 * Sweep check for AC:B7:7 and AC:B7:8 (I-1): a `GRACE_PERIOD` card principal
 * whose clock (`grace_ends_at`) ran out by the act start is read with the
 * `B/09` §4 read and nothing else.
 *
 * - `CHARGED`: the charge is settled (P1 + S5, {@link settleChargedPeriod});
 *   never S6. If it cannot be settled the error propagates and the row is
 *   retried by the next run.
 * - `UNKNOWN` (any reason): S6 does not run. Aged from the latest record's
 *   `date_created` (else from `grace_started_at`, I-11): more than a day →
 *   DEC-OBS-001 notice; three days or more → reason 21 (S14 accumulates it).
 * - `NOT_CHARGED` / no current period: S6 by its first event, unless reason 21
 *   is open on the row, in which case S6 waits for a person (S15).
 *
 * @param ports - S6's ports, `recordChargeFact`'s and the notice channel
 * @returns The row check the reconciliation sweep runs per row
 */
export function createGraceExpiryCheck(ports: GraceExpiryCheckPorts): ReconciliationRowCheck {
    return async (input) => {
        const { subscription } = input;
        if (subscription.status !== 'GRACE_PERIOD') return;
        if (subscription.class !== 'PRINCIPAL' || subscription.paymentMethod !== 'CARD') return;
        const { graceEndsAt } = subscription;
        if (graceEndsAt === null) return;
        const actStartedAt = actStartInstant({ act: input.act }).at.getTime();
        if (graceEndsAt.getTime() > actStartedAt) return;

        const unresolvedMarkOpen = await hasOpenUnresolvedPeriodChargeMark({
            subscriptionId: subscription.id
        });
        const result = await readPeriodCharges(
            { authorizationRead: input.read, act: input.act },
            { provider: ports.provider }
        );
        switch (result.verdict) {
            case 'NOT_CHARGED':
            case 'NO_CURRENT_PERIOD': {
                if (unresolvedMarkOpen) {
                    logger.info(
                        { subscriptionId: subscription.id, verdict: result.verdict },
                        'Grace expired but reason 21 is open; S6 waits for S15'
                    );
                    return;
                }
                const suspension = await suspendForArrears(
                    {
                        subscriptionId: subscription.id,
                        event: 'GRACE_EXPIRED',
                        occurrenceId: graceExpiredOccurrenceId({
                            subscriptionId: subscription.id,
                            graceEndsAt
                        })
                    },
                    ports
                );
                logger.info(
                    { subscriptionId: subscription.id, verdict: result.verdict, ...suspension },
                    'Grace expiry check ran S6'
                );
                return;
            }
            case 'CHARGED': {
                const settled = await settleChargedPeriod({ chargeId: result.chargeId }, ports);
                logger.info(
                    {
                        subscriptionId: subscription.id,
                        chargeId: result.chargeId,
                        outcome: settled.outcome,
                        ...(settled.outcome === 'CREDITED' && settled.exit
                            ? { exit: settled.exit.outcome }
                            : {})
                    },
                    'Grace expired with a charged period; settled it'
                );
                return;
            }
            case 'UNKNOWN': {
                const since = result.latestCharge
                    ? new Date(result.latestCharge.createdAt)
                    : subscription.graceStartedAt;
                if (since === null) {
                    logger.warn(
                        { subscriptionId: subscription.id, reason: result.reason },
                        'Grace expired with an unresolved period and no instant to age it from'
                    );
                    return;
                }
                const age = actStartedAt - since.getTime();
                if (age >= MARK_AFTER_MS) {
                    await openReconciliationMark({
                        subject: { kind: 'SUBSCRIPTION', subscriptionId: subscription.id },
                        reason: 'COBRO_DEL_PERIODO_SIN_RESOLVER',
                        actor: { type: 'job' },
                        correlationId: randomUUID()
                    });
                    return;
                }
                if (age > NOTIFY_AFTER_MS) {
                    await (ports.unresolvedPeriodCharges ?? loggedUnresolvedPeriodCharges).notify({
                        subscriptionId: subscription.id,
                        chargeId: result.latestCharge?.chargeId ?? null,
                        since,
                        reason: result.reason
                    });
                }
                return;
            }
            default: {
                const unreachable: never = result;
                return unreachable;
            }
        }
    };
}
