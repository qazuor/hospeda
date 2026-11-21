import type { Clock } from '@repo/billing-verticals-contract';
import { and, eq, getDb, idempotencyKeys, payments, refundCalls, refunds } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { actStartInstant, assertFreshForAct } from '@repo/payments';
import { readRefundCallTally } from './refund-call-tally';
import { failRefund } from './refund-fail';
import { lockRefundSource } from './refund-source';

/** What {@link settleRefundRejectedAfterAcceptance} did. */
export type RefundRejectedAfterAcceptanceOutcome =
    /** No accepted call of this refund is read rejected: nothing changed. */
    | 'NONE'
    /** Every call the provider had accepted is now rejected: the refund failed (RF5). */
    | 'FAILED'
    /** Some accepted calls were rejected, others still stand: the refund stays CONFIRMED. */
    | 'KEPT_CONFIRMED';

/**
 * HOS-2516 review: a refund the provider ACCEPTED and later REJECTED had no exit. RF3 never
 * executes it (the read shows it not accredited), decline refuses it (it has provider calls), and
 * the remainder settlement refuses it (`ACCEPTED_PART_NOT_ACCREDITED`).
 *
 * This reads the charge and, for every accepted call whose provider refund the read reports
 * `rejected` (a status the provider names, never a refund merely not accredited yet, see
 * `ChargeRefund.rejected`), records that call as a provider rejection: its `provider_refund_id` is
 * cleared and its stored result becomes `REJECTED` with code `REJECTED_AFTER_ACCEPTANCE`, keeping
 * the provider id in the result for the audit trail. That is the provider's own answer, and it
 * moved no money, so the call stops counting as live (`refund-moved-money`). Then, the same way an
 * answered 4xx with no accepted amount does, a refund with no live call left fails (RF5). One
 * that still has another accepted call stays CONFIRMED, and the remainder settlement (HOS-2406)
 * now applies to it. No new refund state: FAILED and CONFIRMED keep their existing exits.
 *
 * @param input.refundId - The CONFIRMED refund to check.
 * @param input.correlationId - Correlation id for the RF5 event.
 * @param ports - The payment provider and the clock.
 * @returns What changed.
 */
export async function settleRefundRejectedAfterAcceptance(
    input: { readonly refundId: string; readonly correlationId?: string },
    ports: { readonly provider: PaymentProvider; readonly clock: Clock }
): Promise<{ readonly outcome: RefundRejectedAfterAcceptanceOutcome }> {
    const db = getDb();
    const [refund] = await db.select().from(refunds).where(eq(refunds.id, input.refundId)).limit(1);
    if (refund?.status !== 'CONFIRMED' || !refund.paymentId) return { outcome: 'NONE' };
    const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, refund.paymentId))
        .limit(1);
    if (!payment) return { outcome: 'NONE' };
    const { acceptedIds } = await readRefundCallTally({ db, refundId: refund.id });
    if (acceptedIds.length === 0) return { outcome: 'NONE' };
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readCharge({ chargeId: payment.providerFactId });
    const { snapshot } = assertFreshForAct({ read, act });
    const rejectedIds = snapshot.refunds
        .filter((entry) => entry.rejected === true && acceptedIds.includes(entry.refundId))
        .map((entry) => entry.refundId);
    if (rejectedIds.length === 0) return { outcome: 'NONE' };
    return db.transaction(async (tx) => {
        await lockRefundSource({ tx, source: { kind: 'PAYMENT', id: payment.id } });
        const [locked] = await tx
            .select()
            .from(refunds)
            .where(eq(refunds.id, refund.id))
            .limit(1)
            .for('update');
        if (locked?.status !== 'CONFIRMED') return { outcome: 'NONE' as const };
        for (const providerRefundId of rejectedIds) {
            const [call] = await tx
                .update(refundCalls)
                .set({ providerRefundId: null })
                .where(
                    and(
                        eq(refundCalls.refundId, refund.id),
                        eq(refundCalls.providerRefundId, providerRefundId)
                    )
                )
                .returning({ key: refundCalls.idempotencyKey });
            if (!call) continue;
            await tx
                .update(idempotencyKeys)
                .set({
                    result: {
                        outcome: 'REJECTED',
                        code: 'REJECTED_AFTER_ACCEPTANCE',
                        providerRefundId
                    }
                })
                .where(eq(idempotencyKeys.key, call.key));
        }
        const after = await readRefundCallTally({ db: tx, refundId: refund.id });
        if (after.awaitingProviderAnswer || after.acceptedIds.length > 0)
            return { outcome: 'KEPT_CONFIRMED' as const };
        const failed = await failRefund({
            tx,
            refund: locked,
            at: ports.clock.now(),
            correlationId: input.correlationId ?? crypto.randomUUID()
        });
        return { outcome: failed.failed ? ('FAILED' as const) : ('KEPT_CONFIRMED' as const) };
    });
}
