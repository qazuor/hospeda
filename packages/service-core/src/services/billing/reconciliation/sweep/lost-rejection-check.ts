import type { Clock } from '@repo/billing-verticals-contract';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import {
    type EnterGracePorts,
    enterGraceOnRejectedCharge
} from '../../subscription/enter-grace.service.js';
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
