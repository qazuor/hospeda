import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct } from '@repo/payments';
import {
    arrearsPauseDecision,
    type GraceExpiryCheckPorts,
    runArrearsDecisionAfterPeriodRead
} from './grace-expiry-check.js';
import type { ReconciliationRowCheck } from './reconciliation-sweep.service.js';

const logger = createLogger('billing-provider-pause-check');

/**
 * Reads a card principal's preapproval once per sweep row. A provider pause is
 * treated as S6's second event; the shared period decision still protects a
 * current payment. An expired grace is left for the first event's check.
 *
 * @param ports - S6, period settlement and unresolved-period notice ports
 * @returns The row check for the reconciliation sweep
 */
export function createProviderPauseCheck(ports: GraceExpiryCheckPorts): ReconciliationRowCheck {
    return async (input) => {
        const { subscription } = input;
        if (subscription.status !== 'ACTIVE' && subscription.status !== 'GRACE_PERIOD') return;
        if (subscription.class !== 'PRINCIPAL' || subscription.paymentMethod !== 'CARD') return;

        const { snapshot } = assertFreshForAct({ read: input.read, act: input.act });
        if (snapshot.status !== 'paused') {
            logger.debug(
                { subscriptionId: subscription.id, read: snapshot.status },
                'Provider pause check found no paused authorization'
            );
            return;
        }

        const at = actStartInstant({ act: input.act }).at;
        if (
            subscription.status === 'GRACE_PERIOD' &&
            subscription.graceEndsAt !== null &&
            subscription.graceEndsAt <= at
        ) {
            logger.debug(
                { subscriptionId: subscription.id, read: snapshot.status },
                'Provider pause check leaves expired grace to the first S6 event'
            );
            return;
        }

        const decision = arrearsPauseDecision({ subscription, at });
        if (!decision) return;
        const stopped = await runArrearsDecisionAfterPeriodRead(
            { subscription, read: input.read, act: input.act, ...decision },
            ports
        );
        logger.info(
            { subscriptionId: subscription.id, read: snapshot.status, event: decision.event },
            'Provider pause check completed arrears decision'
        );
        return stopped ? 'STOP_REMAINING_CHECKS' : undefined;
    };
}
