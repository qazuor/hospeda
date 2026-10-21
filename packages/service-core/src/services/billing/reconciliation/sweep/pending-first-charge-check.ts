import { and, asc, eq, getDb, payments } from '@repo/db';
import { createLogger } from '@repo/logger';
import { assertFreshForAct } from '@repo/payments';
import {
    type DeclineFirstChargePorts,
    declineFirstCharge
} from '../../subscription/decline-first-charge.service.js';
import type { ReconciliationRowCheck } from './reconciliation-sweep.service.js';

const logger = createLogger('billing-pending-first-charge-check');

/** Closes a pending card signup when reconciliation reads its authorization as cancelled. */
export function createPendingFirstChargeDeclineCheck(
    ports: DeclineFirstChargePorts
): ReconciliationRowCheck {
    return async (input) => {
        if (
            input.subscription.status !== 'PENDING_AUTHORIZATION' ||
            input.subscription.class !== 'PRINCIPAL' ||
            input.subscription.paymentMethod !== 'CARD'
        ) {
            return;
        }

        const { snapshot } = assertFreshForAct({ read: input.read, act: input.act });
        if (snapshot.status !== 'cancelled') {
            logger.info(
                { subscriptionId: input.subscription.id, authorizationStatus: snapshot.status },
                'Pending signup authorization remains live'
            );
            return;
        }

        const facts = await getDb()
            .select({ providerFactId: payments.providerFactId })
            .from(payments)
            .where(
                and(
                    eq(payments.subscriptionId, input.subscription.id),
                    eq(payments.status, 'PENDING')
                )
            )
            .orderBy(asc(payments.factAt));

        if (facts.length === 0) {
            logger.info(
                { subscriptionId: input.subscription.id },
                'Cancelled pending signup has no pending payment fact; S3 owns expiry'
            );
            return;
        }

        for (const fact of facts) {
            const result = await declineFirstCharge({ chargeId: fact.providerFactId }, ports);
            logger.info(
                {
                    subscriptionId: input.subscription.id,
                    providerFactId: fact.providerFactId,
                    outcome: result.outcome,
                    ...(result.outcome === 'NOT_APPLICABLE' ? { reason: result.reason } : {})
                },
                'Reconciled pending first-charge decline'
            );
            if (result.outcome === 'DECLINED') return;
        }
    };
}
