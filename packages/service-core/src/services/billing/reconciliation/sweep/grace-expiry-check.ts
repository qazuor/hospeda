import { createLogger } from '@repo/logger';
import { actStartInstant } from '@repo/payments';
import {
    type SuspendForArrearsPorts,
    suspendForArrears
} from '../../subscription/suspend-for-arrears.service.js';
import { readPeriodCharges } from '../period-charges/read-period-charges.js';
import type { ReconciliationRowCheck } from './reconciliation-sweep.service.js';

const logger = createLogger('billing-grace-expiry-check');

/** Ports of the grace expiry check: exactly S6's (B4.2 and B7.4b wire the optional ones). */
export type GraceExpiryCheckPorts = SuspendForArrearsPorts;

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
 * Sweep check for AC:B7:7 (I-1): a `GRACE_PERIOD` card principal whose clock
 * (`grace_ends_at`) ran out by the act start is read with the `B/09` §4 read and
 * nothing else. "Did not charge" (`NOT_CHARGED`, or no current period) runs S6
 * by its first event. `CHARGED` and `UNKNOWN` are AC:B7:8 (run 3): they do
 * nothing yet.
 *
 * @param ports - S6's ports
 * @returns The row check the reconciliation sweep runs per row
 */
export function createGraceExpiryCheck(ports: GraceExpiryCheckPorts): ReconciliationRowCheck {
    return async (input) => {
        const { subscription } = input;
        if (subscription.status !== 'GRACE_PERIOD') return;
        if (subscription.class !== 'PRINCIPAL' || subscription.paymentMethod !== 'CARD') return;
        const { graceEndsAt } = subscription;
        if (graceEndsAt === null) return;
        if (graceEndsAt.getTime() > actStartInstant({ act: input.act }).at.getTime()) return;

        const result = await readPeriodCharges(
            { authorizationRead: input.read, act: input.act },
            { provider: ports.provider }
        );
        switch (result.verdict) {
            case 'NOT_CHARGED':
            case 'NO_CURRENT_PERIOD': {
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
            case 'CHARGED':
            case 'UNKNOWN':
                logger.info(
                    { subscriptionId: subscription.id, verdict: result.verdict },
                    'Grace expired with a charged or unresolved period; left to AC:B7:8'
                );
                return;
            default: {
                const unreachable: never = result;
                return unreachable;
            }
        }
    };
}
