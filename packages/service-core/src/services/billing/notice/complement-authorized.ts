import { getDb } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { applyA2Recurring, emitAddonCoverageAdded } from '../addon/addon-instance-a2';
import type { A5Ports } from '../addon/addon-instance-a5';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports';
import { activatePendingWithSignupNotice } from '../subscription/activate-pending-with-signup-notice';
import {
    type AfterSubscriptionActivatedPorts,
    afterSubscriptionActivated
} from '../subscription/after-activation-commit';
import type { SuccessionCloser } from '../subscription/subscription-billing-ports';

/** Dispatches an authorized pending row by class; only PRINCIPAL runs signup effects. */
export async function activateAuthorizedPending(
    input: {
        readonly row: Parameters<typeof afterSubscriptionActivated>[0]['subscription'] & {
            readonly class: string;
        };
        readonly now: Date;
    },
    ports: AfterSubscriptionActivatedPorts & {
        readonly successionCloser: SuccessionCloser;
        readonly complements?: A5Ports;
        readonly coverageNotices?: CoverageNotices;
    }
): Promise<boolean> {
    if (input.row.class === 'PRINCIPAL') {
        const changed = await activatePendingWithSignupNotice(
            { subscriptionId: input.row.id, now: input.now },
            { successionCloser: ports.successionCloser }
        );
        if (changed) await afterSubscriptionActivated({ subscription: input.row }, ports);
        return changed;
    }
    if (input.row.class !== 'COMPLEMENTO')
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Unsupported pending subscription class'
        );
    if (!ports.complements)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Addon policy ports are not registered'
        );
    const complements = ports.complements;
    const activated = await getDb().transaction((tx) =>
        applyA2Recurring(
            { tx, complementSubscriptionId: input.row.id, now: input.now },
            complements
        )
    );
    if (activated.outcome !== 'ACTIVATED') return false;
    await emitAddonCoverageAdded({
        activated: [activated],
        coverageNotices: ports.coverageNotices ?? unwiredCoverageNotices
    });
    return true;
}
