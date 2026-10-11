import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import {
    and,
    eq,
    getDb,
    inArray,
    manualPayments,
    payments,
    reconciliationMarkPayments
} from '@repo/db';
import type {
    HangablePayment,
    ReconciliationMarkPayments
} from '../reconciliation/reconciliation-mark-payments.port';
import { unimplementedReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port';
import type { SubscriptionPayments } from '../subscription/subscription-billing-ports';

const CREDITED_PROVIDER_STATUSES = [
    'SUCCEEDED',
    'PARTIALLY_REFUNDED',
    'REFUNDED',
    'CHARGED_BACK'
] as const;

/** B5's ledger implementation; B3.6 must opt into it when composing the receiver. */
export const creditedPaymentsFromLedger: SubscriptionPayments = {
    async hasCreditedPayment({ subscriptionId, tx }) {
        const db = tx ?? getDb();
        const [providerPayment] = await db
            .select({ id: payments.id })
            .from(payments)
            .where(
                and(
                    eq(payments.subscriptionId, subscriptionId),
                    inArray(payments.status, [...CREDITED_PROVIDER_STATUSES])
                )
            )
            .limit(1);
        if (providerPayment) return true;
        const [manualPayment] = await db
            .select({ id: manualPayments.id })
            .from(manualPayments)
            .where(
                and(
                    eq(manualPayments.subscriptionId, subscriptionId),
                    eq(manualPayments.status, 'REGISTERED')
                )
            )
            .limit(1);
        return Boolean(manualPayment);
    }
};

export async function hangPaymentOnMark(input: {
    readonly markId: string;
    readonly payment: HangablePayment;
    readonly tx: DrizzleClient;
    readonly hungAt: Date;
}): Promise<void> {
    await input.tx.insert(reconciliationMarkPayments).values({
        markId: input.markId,
        paymentId: input.payment.source === 'PAYMENT' ? input.payment.id : null,
        manualPaymentId: input.payment.source === 'MANUAL_PAYMENT' ? input.payment.id : null,
        hungAt: input.hungAt
    });
}

/** B5 writes hang; B5.7b (HOS-1548) supplies unresolved counting and accumulation. */
export function createPaymentReconciliationMarkPayments(clock: Clock): ReconciliationMarkPayments {
    return {
        hang: async (input) => hangPaymentOnMark({ ...input, hungAt: clock.now() }),
        countUnresolved: (input) => unimplementedReconciliationMarkPayments.countUnresolved(input)
    };
}
