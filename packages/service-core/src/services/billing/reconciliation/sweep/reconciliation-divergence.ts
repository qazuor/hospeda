import type { ReconciliationMarkReason, SelectProviderLink, SelectSubscription } from '@repo/db';
import type { ActStart, AuthorizationSnapshot, ProviderRead } from '@repo/payments';
import { openReconciliationMark } from '../open-reconciliation-mark.service.js';
import type {
    HangablePayment,
    ReconciliationMarkPayments
} from '../reconciliation-mark-payments.port.js';

export interface ReconciliationDivergence {
    readonly reason: ReconciliationMarkReason;
    readonly payment?: HangablePayment;
}

export interface ReconciliationComparisonInput {
    readonly subscription: SelectSubscription;
    readonly providerLink: SelectProviderLink;
    readonly read: ProviderRead<AuthorizationSnapshot>;
    readonly act: ActStart;
}

export type ReconciliationComparison = (
    input: ReconciliationComparisonInput
) => readonly ReconciliationDivergence[] | Promise<readonly ReconciliationDivergence[]>;

export interface RecordDivergenceInput {
    readonly subscriptionId: string;
    readonly divergence: ReconciliationDivergence;
    readonly correlationId: string;
}

/**
 * AC:B11:7: la única reparación automática de la conciliación es el vínculo (el manejador del desconocido); una divergencia de monto, de estado o de cobro NO escribe el valor del proveedor: abre la marca del motivo que corresponde, y `openReconciliationMark` emite el evento crítico `reconciliation.mark_opened`, que es el `RECONCILIATION_REQUIRED` de la spec (Coord-66).
 */
export async function recordDivergence(
    input: RecordDivergenceInput,
    ports: { readonly markPayments?: ReconciliationMarkPayments } = {}
) {
    const reason: ReconciliationMarkReason = input.divergence.reason;
    const result = await openReconciliationMark(
        {
            subject: { kind: 'SUBSCRIPTION', subscriptionId: input.subscriptionId },
            reason,
            payment: input.divergence.payment,
            actor: { type: 'job' },
            correlationId: input.correlationId
        },
        ports.markPayments ? { markPayments: ports.markPayments } : {}
    );
    return { markId: result.mark.id, markOutcome: result.outcome };
}
