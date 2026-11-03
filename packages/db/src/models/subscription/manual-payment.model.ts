import { and, asc, desc, eq, lte, notExists } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    manualPayments,
    type SelectManualPayment
} from '../../schemas/vertical/manual-payment.dbschema.ts';
import { subscriptions } from '../../schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Persistence for manual subscription installments. */
export class ManualPaymentModel {
    /** Finds due active manual principals without an installment for their charge date. */
    async findDueManualSubscriptions(input: {
        readonly now: Date;
        readonly limit: number;
        readonly tx?: DrizzleClient;
    }) {
        return (input.tx ?? getDb())
            .select()
            .from(subscriptions)
            .where(
                and(
                    eq(subscriptions.class, 'PRINCIPAL'),
                    eq(subscriptions.paymentMethod, 'MANUAL'),
                    eq(subscriptions.status, 'ACTIVE'),
                    lte(subscriptions.nextChargeAt, input.now),
                    notExists(
                        (input.tx ?? getDb())
                            .select({ id: manualPayments.id })
                            .from(manualPayments)
                            .where(
                                and(
                                    eq(manualPayments.subscriptionId, subscriptions.id),
                                    eq(manualPayments.periodStart, subscriptions.nextChargeAt)
                                )
                            )
                    )
                )
            )
            .orderBy(asc(subscriptions.nextChargeAt))
            .limit(input.limit);
    }

    /** Checks every installment status for a subscription period in the caller's transaction. */
    async hasInstallmentForPeriod(input: {
        readonly subscriptionId: string;
        readonly periodStart: Date;
        readonly tx: DrizzleClient;
    }): Promise<boolean> {
        const [row] = await input.tx
            .select({ id: manualPayments.id })
            .from(manualPayments)
            .where(
                and(
                    eq(manualPayments.subscriptionId, input.subscriptionId),
                    eq(manualPayments.periodStart, input.periodStart)
                )
            )
            .limit(1)
            .for('update');
        return Boolean(row);
    }

    /** Opens an awaiting installment inside the caller's transaction. */
    async insertAwaitingInstallment(input: {
        readonly subscriptionId: string;
        readonly periodStart: Date;
        readonly tx: DrizzleClient;
    }): Promise<SelectManualPayment> {
        const [row] = await input.tx
            .insert(manualPayments)
            .values({
                subscriptionId: input.subscriptionId,
                periodStart: input.periodStart,
                status: 'AWAITING',
                registeredBy: null,
                registeredAt: null,
                proofRef: null
            })
            .returning();
        if (!row) throw new Error('Manual payment insert returned no row');
        return row;
    }

    /** Reads the latest awaiting installment of one subscription. */
    async findAwaitingInstallment(input: {
        readonly subscriptionId: string;
        readonly tx?: DrizzleClient;
    }): Promise<SelectManualPayment | null> {
        const [row] = await (input.tx ?? getDb())
            .select()
            .from(manualPayments)
            .where(
                and(
                    eq(manualPayments.subscriptionId, input.subscriptionId),
                    eq(manualPayments.status, 'AWAITING')
                )
            )
            .orderBy(desc(manualPayments.periodStart))
            .limit(1);
        return row ?? null;
    }
}

/** Shared manual installment model. */
export const manualPaymentModel = new ManualPaymentModel();
