import { and, asc, gt, gte, inArray, isNotNull } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { payments, type SelectPayment } from '../../schemas/vertical/payment.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/**
 * The credited payment states the credited-payments check re-reads (AC:B11:12,
 * HOS-1605 H8). `CHARGED_BACK` is not one of them: it is re-read in Phase 2
 * (AC:B11:25).
 */
export const CREDITED_PAYMENT_CHECK_STATUSES = [
    'SUCCEEDED',
    'PARTIALLY_REFUNDED',
    'REFUNDED'
] as const;

/** Input for one keyset page of credited subscription payments inside the window. */
export interface ListCreditedPaymentsInWindowPageInput {
    /** Inclusive lower bound on `fact_at` (now − deadline 18). */
    readonly since: Date;
    /** Exclusive id cursor. */
    readonly afterPaymentId?: string;
    /** Maximum rows to return. */
    readonly limit: number;
    /** Optional transaction client. */
    readonly tx?: DrizzleClient;
}

/** Read model for the credited-payments check of the reconciliation sweep (AC:B11:12). */
export class ReconciliationCreditedPaymentModel {
    /**
     * One keyset page of subscription payments in a credited state whose fact
     * is inside the window, by id. A one-time addon payment (no subscription)
     * is left out (HOS-1605 H8).
     */
    async listCreditedPaymentsInWindowPage(
        input: ListCreditedPaymentsInWindowPageInput
    ): Promise<SelectPayment[]> {
        const db = input.tx ?? getDb();
        return db
            .select()
            .from(payments)
            .where(
                and(
                    isNotNull(payments.subscriptionId),
                    inArray(payments.status, [...CREDITED_PAYMENT_CHECK_STATUSES]),
                    gte(payments.factAt, input.since),
                    input.afterPaymentId === undefined
                        ? undefined
                        : gt(payments.id, input.afterPaymentId)
                )
            )
            .orderBy(asc(payments.id))
            .limit(input.limit);
    }
}

/** Shared credited-payment read model of the reconciliation sweep. */
export const reconciliationCreditedPaymentModel = new ReconciliationCreditedPaymentModel();
