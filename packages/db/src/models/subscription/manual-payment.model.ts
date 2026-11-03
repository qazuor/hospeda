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

    /** Locks one installment after its subscription has been locked. */
    async lockInstallment(input: {
        readonly manualPaymentId: string;
        readonly tx: DrizzleClient;
    }): Promise<SelectManualPayment | null> {
        const [row] = await input.tx
            .select()
            .from(manualPayments)
            .where(eq(manualPayments.id, input.manualPaymentId))
            .limit(1)
            .for('update');
        return row ?? null;
    }

    /** Whether this is the earliest period opened for the subscription. */
    async isFirstInstallment(input: {
        readonly subscriptionId: string;
        readonly manualPaymentId: string;
        readonly tx: DrizzleClient;
    }): Promise<boolean> {
        const [first] = await input.tx
            .select({ id: manualPayments.id })
            .from(manualPayments)
            .where(eq(manualPayments.subscriptionId, input.subscriptionId))
            .orderBy(
                asc(manualPayments.periodStart),
                asc(manualPayments.createdAt),
                asc(manualPayments.id)
            )
            .limit(1);
        return first?.id === input.manualPaymentId;
    }

    /** Registers an awaiting installment, guarded against concurrent registration. */
    async markRegistered(input: {
        readonly manualPaymentId: string;
        readonly registeredBy: string;
        readonly registeredAt: Date;
        readonly proofRef?: string;
        readonly tx: DrizzleClient;
    }): Promise<boolean> {
        const [row] = await input.tx
            .update(manualPayments)
            .set({
                status: 'REGISTERED',
                registeredBy: input.registeredBy,
                registeredAt: input.registeredAt,
                proofRef: input.proofRef ?? null,
                updatedAt: input.registeredAt
            })
            .where(
                and(
                    eq(manualPayments.id, input.manualPaymentId),
                    eq(manualPayments.status, 'AWAITING')
                )
            )
            .returning({ id: manualPayments.id });
        return Boolean(row);
    }

    /** Declares an awaiting installment unpaid inside the caller's transaction. */
    async markDeclaredUnpaid(input: {
        readonly manualPaymentId: string;
        readonly tx: DrizzleClient;
    }): Promise<boolean> {
        const [row] = await input.tx
            .update(manualPayments)
            .set({ status: 'DECLARED_UNPAID' })
            .where(
                and(
                    eq(manualPayments.id, input.manualPaymentId),
                    eq(manualPayments.status, 'AWAITING')
                )
            )
            .returning({ id: manualPayments.id });
        return Boolean(row);
    }
}

/** Shared manual installment model. */
export const manualPaymentModel = new ManualPaymentModel();
