import type { Clock } from '@repo/billing-verticals-contract';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import {
    type EnterGracePorts,
    enterGraceOnRejectedCharge
} from '../../subscription/enter-grace.service.js';
import { noCreditedPayments } from '../../subscription/subscription-billing-ports.js';
import { readPeriodCharges } from '../period-charges/read-period-charges.js';
import type { ReconciliationRowCheck } from './reconciliation-sweep.service.js';

const logger = createLogger('billing-lost-rejection-check');

export interface LostFirstRejectionCheckPorts extends EnterGracePorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
}

/** Runs S4 for an ACTIVE card principal whose current period was rejected. */
export function createLostFirstRejectionCheck(
    ports: LostFirstRejectionCheckPorts
): ReconciliationRowCheck {
    return async (input) => {
        if (input.subscription.status !== 'ACTIVE') return;
        if (input.subscription.class !== 'PRINCIPAL' || input.subscription.paymentMethod !== 'CARD')
            return;
        // DEC-MP-008 📌1 point 1: only a row with a credited payment of its own enters grace from
        // a lost rejection; the successor of a paying predecessor (AC:B7:4) is a declared border.
        const payments = ports.payments ?? noCreditedPayments;
        if (!(await payments.hasCreditedPayment({ subscriptionId: input.subscription.id }))) {
            logger.info(
                { subscriptionId: input.subscription.id },
                "DEC-MP-008 📌1: the successor's lost first rejection is a declared border"
            );
            return;
        }

        const result = await readPeriodCharges(
            { authorizationRead: input.read, act: input.act },
            { provider: ports.provider }
        );
        if (result.verdict !== 'NOT_CHARGED') return;

        const grace = await enterGraceOnRejectedCharge({ chargeId: result.chargeId }, ports);
        if (grace.outcome !== 'GRACE_STARTED') {
            logger.info(
                {
                    subscriptionId: input.subscription.id,
                    chargeId: result.chargeId,
                    outcome: grace.outcome,
                    ...(grace.outcome === 'NOT_APPLICABLE' ? { reason: grace.reason } : {})
                },
                'Lost rejection did not start grace'
            );
        }
    };
}
