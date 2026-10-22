/** Hourly payment expiry sweep for closed retry windows (P2) and terminal rejections (P8). */
import type { Clock } from '@repo/billing-verticals-contract';
import { and, asc, eq, getDb, gt, isNotNull, payments } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { actStartInstant, assertFreshForAct } from '@repo/payments';
import { lastCycleRecordIsOpen } from '../reconciliation/sweep/last-cycle-record.js';
import { failPayment } from './fail-payment.service.js';
import { isRejectedWithoutRetryWindow } from './rejected-charge-terminal.js';

const logger = createLogger('payment-window-expiry');

/** Ports needed to decide whether a pending payment's provider window has closed. */
export interface ExpireLapsedPaymentsPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
}

/** Counts the outcomes for one complete scan of pending subscription payments. */
export interface ExpireLapsedPaymentsSummary {
    readonly scanned: number;
    readonly failed: number;
    readonly notPending: number;
    readonly open: number;
    readonly errors: number;
}

/**
 * Re-reads every pending subscription payment by provider id and applies P2
 * when a rejected charge's collection window has closed, or P8 when it has no
 * retry window (HOS-1734).
 *
 * @param input - Optional keyset page size; defaults to 100.
 * @param ports - Provider reader and clock used for each payment act.
 * @returns Counts for all candidates visited during this call.
 */
export async function expireLapsedPayments(
    input: { readonly pageSize?: number },
    ports: ExpireLapsedPaymentsPorts
): Promise<ExpireLapsedPaymentsSummary> {
    const summary = { scanned: 0, failed: 0, notPending: 0, open: 0, errors: 0 };
    const pageSize = input.pageSize ?? 100;
    let cursor: string | undefined;

    while (true) {
        const conditions = [eq(payments.status, 'PENDING'), isNotNull(payments.subscriptionId)];
        if (cursor) conditions.push(gt(payments.id, cursor));
        const rows = await getDb()
            .select({ id: payments.id, providerFactId: payments.providerFactId })
            .from(payments)
            .where(and(...conditions))
            .orderBy(asc(payments.id))
            .limit(pageSize);
        if (rows.length === 0) break;

        for (const row of rows) {
            summary.scanned++;
            try {
                const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
                const actStartedAt = actStartInstant({ act }).at.getTime();
                const read = await ports.provider.readCharge({ chargeId: row.providerFactId });
                const { snapshot: charge } = assertFreshForAct({ read, act });
                const closedWithoutCollection =
                    charge.purpose === 'charge' &&
                    charge.status === 'rejected' &&
                    !lastCycleRecordIsOpen({
                        charges: [
                            {
                                createdAt: charge.createdAt,
                                expiresAt: charge.expiresAt,
                                status: charge.status,
                                purpose: charge.purpose
                            }
                        ],
                        complete: true,
                        actStartedAt
                    });
                const terminalRejection = isRejectedWithoutRetryWindow({ charge });
                if (!closedWithoutCollection && !terminalRejection) {
                    summary.open++;
                    continue;
                }

                const result = await failPayment({ paymentId: row.id }, { clock: ports.clock });
                if (result.outcome === 'FAILED') summary.failed++;
                else summary.notPending++;
            } catch (error) {
                summary.errors++;
                logger.warn(
                    {
                        paymentId: row.id,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    'Could not expire pending payment after provider window read'
                );
            }
        }

        cursor = rows[rows.length - 1]?.id;
        if (rows.length < pageSize) break;
    }

    return summary;
}
