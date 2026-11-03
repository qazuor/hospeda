import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    manualPayments,
    type SelectManualPayment
} from '../../schemas/vertical/manual-payment.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Persistence for manual subscription installments. */
export class ManualPaymentModel {
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
