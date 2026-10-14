import type { ReconciliationMarkReason, SUBSCRIPTION_STATUSES } from '@repo/db';
import type { LatePaymentConditionsVerdict } from '../../../subscription/late-payment-conditions.js';

/** Internal row and period facts needed by H5; no provider status types enter the pure table. */
export interface UnregisteredChargeFacts {
    readonly class: string;
    readonly status: (typeof SUBSCRIPTION_STATUSES)[number];
    readonly isLiveSuccessionPredecessor: boolean;
    readonly cancellationDecision: { readonly transition: string; readonly decidedAt: Date } | null;
    readonly openPauseStartsAt: Date | null;
    readonly chargeCreatedAt: Date;
    readonly latePaymentVerdict: LatePaymentConditionsVerdict | null;
}

const UNREGISTERED = 'COBRO_SIN_REGISTRAR' as const satisfies ReconciliationMarkReason;
const AFTER_CANCELLATION = 'COBRO_POSTERIOR_A_LA_BAJA' as const satisfies ReconciliationMarkReason;
const AFTER_GRANT = 'COBRO_POSTERIOR_AL_GRANT' as const satisfies ReconciliationMarkReason;
const LATE_REJECTED = 'PAGO_TARDIO_RECHAZADO' as const satisfies ReconciliationMarkReason;

/** Pure H5 tie-break table for an approved unregistered provider charge. */
export function reasonForUnregisteredCharge(input: {
    readonly facts: UnregisteredChargeFacts;
}): ReconciliationMarkReason {
    const { facts } = input;
    if (facts.class === 'LAPIDA') return LATE_REJECTED;
    if (facts.isLiveSuccessionPredecessor) return UNREGISTERED;
    switch (facts.status) {
        case 'CANCELLED':
            return facts.cancellationDecision?.transition === 'S13' ||
                facts.cancellationDecision?.transition === 'S20'
                ? AFTER_GRANT
                : AFTER_CANCELLATION;
        case 'ABANDONED':
        case 'CHARGE_DECLINED':
            return AFTER_CANCELLATION;
        case 'CANCEL_SCHEDULED':
            return facts.cancellationDecision?.transition === 'S11' &&
                facts.chargeCreatedAt.getTime() < facts.cancellationDecision.decidedAt.getTime()
                ? UNREGISTERED
                : AFTER_CANCELLATION;
        case 'PAUSED':
            return facts.openPauseStartsAt !== null &&
                facts.chargeCreatedAt.getTime() < facts.openPauseStartsAt.getTime()
                ? UNREGISTERED
                : LATE_REJECTED;
        case 'ACTIVE':
        case 'PENDING_AUTHORIZATION':
            return UNREGISTERED;
        case 'GRACE_PERIOD':
        case 'SUSPENDED':
            return facts.latePaymentVerdict &&
                ('retainedForS19' in facts.latePaymentVerdict || facts.latePaymentVerdict.ok)
                ? UNREGISTERED
                : LATE_REJECTED;
    }
}
