import type { Clock } from '@repo/billing-verticals-contract';
import { eq, getDb, manualPaymentModel, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { z } from 'zod';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports';
import { graceExpiredOccurrenceId } from '../reconciliation/sweep/grace-expiry-check';
import { readArrearsSuspensionNoticeContent } from './arrears-suspension-notice';
import {
    emitArrearsSuspensionCoverageChanged,
    writeArrearsSuspensionInTx
} from './arrears-suspension-write';
import type { BeforeCancelNotice } from './start-subscription.service';

const logger = createLogger('expire-manual-grace');
const inputSchema = z.strictObject({ pageSize: z.number().int().positive().max(1000) });

class CandidateSkipped extends Error {
    constructor(readonly reason: string) {
        super(reason);
    }
}

/** Dependencies for the manual grace expiry clock. */
export interface ExpireManualGracesPorts {
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly coverageNotices?: CoverageNotices;
}

/** Declares due manual installments unpaid and suspends each row atomically. */
export async function expireManualGraces(
    input: { readonly pageSize: number },
    ports: ExpireManualGracesPorts
): Promise<{ scanned: number; suspended: number; skipped: number; errors: number }> {
    const { pageSize } = inputSchema.parse(input);
    const now = ports.clock.now();
    const candidates = await manualPaymentModel.findManualGracesDue({ now, limit: pageSize });
    const summary = { scanned: candidates.length, suspended: 0, skipped: 0, errors: 0 };
    for (const candidate of candidates) {
        try {
            const content = await readArrearsSuspensionNoticeContent({
                subscription: candidate,
                now
            });
            const committed = await getDb().transaction(async (tx) => {
                const [subscription] = await tx
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, candidate.id))
                    .limit(1)
                    .for('update');
                if (
                    subscription?.status !== 'GRACE_PERIOD' ||
                    subscription.paymentMethod !== 'MANUAL' ||
                    subscription.class !== 'PRINCIPAL' ||
                    !subscription.graceEndsAt ||
                    subscription.graceEndsAt > now
                )
                    throw new CandidateSkipped('GRACE_NOT_DUE');
                const awaiting = await manualPaymentModel.findAwaitingInstallment({
                    subscriptionId: candidate.id,
                    tx
                });
                if (!awaiting) throw new CandidateSkipped('INSTALLMENT_NOT_AWAITING');
                const installment = await manualPaymentModel.lockInstallment({
                    manualPaymentId: awaiting.id,
                    tx
                });
                if (installment?.status !== 'AWAITING')
                    throw new CandidateSkipped('INSTALLMENT_NOT_AWAITING');
                const marked = await manualPaymentModel.markDeclaredUnpaid({
                    manualPaymentId: installment.id,
                    tx
                });
                if (!marked) throw new CandidateSkipped('INSTALLMENT_NOT_AWAITING');
                const written = await writeArrearsSuspensionInTx({
                    tx,
                    subscriptionId: candidate.id,
                    origin: 'GRACE_PERIOD',
                    now
                });
                if (written.kind !== 'SUSPENDED') throw new CandidateSkipped(written.kind);
                return { subscription, row: written.row };
            });
            summary.suspended++;
            await emitArrearsSuspensionCoverageChanged({
                row: committed.row,
                coverageNotices: ports.coverageNotices ?? unwiredCoverageNotices
            });
            try {
                await ports.beforeCancelNotice.beforeCancel({
                    subscriptionId: committed.subscription.id,
                    userId: committed.subscription.userId ?? '',
                    kind: 'ARREARS_SUSPENSION',
                    occurrenceId: graceExpiredOccurrenceId({
                        subscriptionId: committed.subscription.id,
                        graceEndsAt: committed.subscription.graceEndsAt ?? now
                    }),
                    content
                });
            } catch (error) {
                logger.error({ subscriptionId: candidate.id, error }, 'Manual grace notice failed');
            }
        } catch (error) {
            if (error instanceof CandidateSkipped) {
                summary.skipped++;
                logger.info(
                    { subscriptionId: candidate.id, reason: error.reason },
                    'Manual grace skipped'
                );
            } else {
                summary.errors++;
                logger.error({ subscriptionId: candidate.id, error }, 'Manual grace expiry failed');
            }
        }
    }
    return summary;
}
