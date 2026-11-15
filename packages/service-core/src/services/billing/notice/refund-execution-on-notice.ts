import type { Clock } from '@repo/billing-verticals-contract';
import { and, eq, getDb, payments, refunds } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { executeRefundFromProviderRead } from '../refund/execute-refund.service.js';

const logger = createLogger('refund-execution-on-notice');

/** Finds confirmed refunds for the payment named by a provider charge notice. */
export interface ConfirmedRefundsForNotice {
    find(input: {
        readonly paymentId: string;
        readonly providerFactId: string;
    }): Promise<readonly string[]>;
}

/** Database-backed default for the notice receiver and the Mercado Pago webhook. */
export const confirmedRefundsForNotice: ConfirmedRefundsForNotice = {
    async find({ paymentId, providerFactId }) {
        const rows = await getDb()
            .select({ id: refunds.id })
            .from(refunds)
            .innerJoin(payments, eq(refunds.paymentId, payments.id))
            .where(
                and(
                    eq(payments.id, paymentId),
                    eq(payments.providerFactId, providerFactId),
                    eq(refunds.status, 'CONFIRMED')
                )
            )
            .orderBy(refunds.createdAt, refunds.id);
        return rows.map((row) => row.id);
    }
};

/** Runs RF3 serially after charge recording; failures are retried by the future sweep. */
export async function executeConfirmedRefundsOnNotice(
    input: {
        readonly paymentId: string;
        readonly providerFactId: string;
        readonly correlationId: string;
    },
    ports: {
        readonly confirmedRefunds?: ConfirmedRefundsForNotice;
        readonly provider: PaymentProvider;
        readonly clock: Clock;
    }
): Promise<void> {
    let refundIds: readonly string[];
    try {
        refundIds = await (ports.confirmedRefunds ?? confirmedRefundsForNotice).find(input);
    } catch (error) {
        logger.error(
            { error, paymentId: input.paymentId, correlationId: input.correlationId },
            'Confirmed refund lookup failed after charge notice'
        );
        return;
    }
    for (const refundId of refundIds) {
        try {
            await executeRefundFromProviderRead(
                { refundId, correlationId: input.correlationId },
                { provider: ports.provider, clock: ports.clock }
            );
        } catch (error) {
            logger.error(
                { error, refundId, correlationId: input.correlationId },
                'RF3 failed after charge notice'
            );
        }
    }
}
