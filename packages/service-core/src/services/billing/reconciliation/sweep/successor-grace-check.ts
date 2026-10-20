import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct } from '@repo/payments';
import { creditedPaymentsFromLedger } from '../../payment/payment-ledger.js';
import { isPayingSuccessorInGrace } from '../../subscription/paying-predecessor-successor.js';
import type { SubscriptionPayments } from '../../subscription/subscription-billing-ports.js';
import {
    type SuspendForArrearsPorts,
    suspendForArrears
} from '../../subscription/suspend-for-arrears.service.js';
import {
    providerPauseObservedOccurrenceId,
    successorProviderCancelledOccurrenceId
} from './grace-expiry-check.js';
import type { ReconciliationRowCheck } from './reconciliation-sweep.service.js';

const logger = createLogger('billing-successor-grace-check');

/** Ports of the successor grace check: S6's, plus the credited-payment read. */
export type SuccessorGraceCheckPorts = SuspendForArrearsPorts & {
    /** Defaults to the payment ledger (`creditedPaymentsFromLedger`). */
    readonly payments?: SubscriptionPayments;
};

/**
 * Sweep check for AC:B7:4 (DEC-SUB-022, TRANS:B:S4 effects): every run re-reads by id
 * the preapproval of the successor of a paying predecessor that entered grace by the
 * successor branch of S4, and ends that grace at once when the provider gave up:
 *
 * - `cancelled` → S6 by its fifth event (`SUCCESSOR_PROVIDER_CANCELLED`);
 * - `paused` → S6 by its second event (`PROVIDER_PAUSE_OBSERVED`);
 * - `active` / `pending` → nothing; the grace keeps running.
 *
 * It never acts on a clock that already ran out (D-12: that is S6's first event,
 * taken by `createGraceExpiryCheck`), nor on a row in grace with a credited payment
 * of its own (that one waits for the mirror or the clock). The status comes from the
 * sweep's read by id (`assertFreshForAct`, G17). S6's outcome is logged; an error
 * propagates, so the row counts as failed and is retried by the next run.
 *
 * @param ports - S6's ports and the optional credited-payment read
 * @returns The row check the reconciliation sweep runs per row
 */
export function createSuccessorGraceCheck(ports: SuccessorGraceCheckPorts): ReconciliationRowCheck {
    return async (input) => {
        const { subscription } = input;
        if (subscription.status !== 'GRACE_PERIOD') return;
        if (subscription.class !== 'PRINCIPAL' || subscription.paymentMethod !== 'CARD') return;
        const { graceStartedAt, graceEndsAt } = subscription;
        if (graceStartedAt === null || graceEndsAt === null) return;
        const actStartedAt = actStartInstant({ act: input.act }).at.getTime();
        if (graceEndsAt.getTime() <= actStartedAt) return;
        const successor = await isPayingSuccessorInGrace({
            subscription,
            payments: ports.payments ?? creditedPaymentsFromLedger
        });
        if (!successor) return;

        const { snapshot } = assertFreshForAct({ read: input.read, act: input.act });
        switch (snapshot.status) {
            case 'cancelled': {
                const suspension = await suspendForArrears(
                    {
                        subscriptionId: subscription.id,
                        event: 'SUCCESSOR_PROVIDER_CANCELLED',
                        occurrenceId: successorProviderCancelledOccurrenceId({
                            subscriptionId: subscription.id,
                            graceStartedAt
                        })
                    },
                    ports
                );
                logger.info(
                    { subscriptionId: subscription.id, read: snapshot.status, ...suspension },
                    'Successor grace check ran S6'
                );
                return;
            }
            case 'paused': {
                const suspension = await suspendForArrears(
                    {
                        subscriptionId: subscription.id,
                        event: 'PROVIDER_PAUSE_OBSERVED',
                        occurrenceId: providerPauseObservedOccurrenceId({
                            subscriptionId: subscription.id,
                            graceStartedAt
                        })
                    },
                    ports
                );
                logger.info(
                    { subscriptionId: subscription.id, read: snapshot.status, ...suspension },
                    'Successor grace check ran S6'
                );
                return;
            }
            case 'active':
            case 'pending': {
                logger.debug(
                    { subscriptionId: subscription.id, read: snapshot.status },
                    'Successor in grace still has a live preapproval'
                );
                return;
            }
            default: {
                const unreachable: never = snapshot.status;
                throw new Error(`Unknown authorization status ${String(unreachable)}`);
            }
        }
    };
}
