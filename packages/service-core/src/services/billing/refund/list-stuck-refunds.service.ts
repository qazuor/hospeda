import { and, asc, count, eq, getDb, payments, refunds } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import {
    type RefundCallTally,
    readRefundCallTallies,
    refundCallRetryCutoff
} from './refund-call-tally';
import { hasLiveProviderCallSql } from './refund-moved-money';

/**
 * The administrative exit the stuck-refund list suggests (HOS-2560): «Retry with MP»
 * (`retryRefundProviderCalls`) or the remainder settlement from the provider panel
 * (`settleRefundRemainder`). Advisory only: both actions revalidate everything.
 */
export type StuckRefundAction = 'RETRY' | 'SETTLE_REMAINDER';

/** One `CONFIRMED` refund stuck on a live provider call. */
export type StuckRefund = {
    readonly refundId: string;
    readonly amountMinor: number;
    readonly currency: string | null;
    readonly createdAt: Date;
    readonly payment: { readonly source: 'PAYMENT' | 'MANUAL_PAYMENT'; readonly id: string };
    readonly providerCallCount: number;
    /** Calls the provider has not answered, by the tally's rule (`refund-call-tally.ts`). */
    readonly unansweredCallCount: number;
    /** When the oldest unanswered call was persisted; null when every call was answered. */
    readonly oldestUnansweredAt: Date | null;
    /** Sum, in cents, of the calls the provider accepted (what we asked, not what it credited). */
    readonly acceptedAmountMinor: number;
    /** The suggested exit; null when neither action can take the refund right now. */
    readonly suggestedAction: StuckRefundAction | null;
};

const listInputSchema = z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    now: z.date()
});

/**
 * Suggests the administrative exit of a stuck refund, mirroring what each action accepts:
 *
 * - An unanswered call of the retired order channel (`addon_instance_id` set) is replayed by
 *   neither: the retry skips it and the remainder settlement refuses it
 *   (`assertUnansweredCallsPastRetryLimit`), so nothing is suggested.
 * - An unanswered call with no stored answer sent less than 24 hours ago
 *   (`created_at >= refundCallRetryCutoff`) belongs to the retry, which resends exactly those.
 * - An unanswered call inside the limit that has a stored answer (no id, not a rejection) is
 *   resent by neither: the retry answers `REFUND_HAS_NO_UNANSWERED_CALL` and the settlement
 *   `REFUND_CALL_UNANSWERED` until the 24 hours pass, so nothing is suggested.
 * - Every unanswered call past the limit: the remainder settlement from the panel (HOS-2538).
 * - Nothing unanswered and the provider accepted less than the refund: the remainder settlement
 *   (HOS-2406). Accepted it all but not yet credited: the retry, which only runs RF3 again
 *   (its `REEXECUTE` mode).
 *
 * The hint is advisory. It does not check `OTHER_REFUND_CALL_UNANSWERED`, the 180-day provider
 * window, or whether the accepted money is already credited (`ACCEPTED_PART_NOT_ACCREDITED`): the
 * actions revalidate all of that when they run.
 *
 * @param input.tally - The refund's call tally.
 * @param input.refundAmount - The refund amount, in cents.
 * @param input.now - The current instant, from the injected clock.
 * @returns The suggested action, or null when neither can take the refund now.
 */
export function suggestStuckRefundAction(input: {
    readonly tally: RefundCallTally;
    readonly refundAmount: number;
    readonly now: Date;
}): StuckRefundAction | null {
    const { tally } = input;
    if (tally.unanswered.some((call) => call.addonInstanceId !== null)) return null;
    const cutoff = refundCallRetryCutoff({ now: input.now });
    const fresh = tally.unanswered.filter((call) => call.createdAt >= cutoff);
    if (fresh.some((call) => call.completedAt === null)) return 'RETRY';
    if (fresh.length > 0) return null;
    if (tally.unanswered.length > 0) return 'SETTLE_REMAINDER';
    if (tally.acceptedIds.length === 0) return null;
    return tally.acceptedAmount < input.refundAmount ? 'SETTLE_REMAINDER' : 'RETRY';
}

/**
 * HOS-2560 — lists the `CONFIRMED` refunds stuck on a live provider call
 * ({@link hasLiveProviderCallSql}: one the provider accepted, or one with no stored answer), the
 * refunds the proposed list leaves out and «Retry with MP» or the remainder settlement resolve.
 * Oldest first. Each item carries its call tally ({@link readRefundCallTallies}) and the
 * suggested exit ({@link suggestStuckRefundAction}).
 *
 * @param input.page - One-based page
 * @param input.pageSize - Page size, 1 to 100
 * @param input.now - The current instant, from the injected clock (the 24-hour retry limit)
 * @returns The page of stuck refunds and the total across pages
 * @throws {ServiceError} VALIDATION_ERROR when the pagination is invalid
 */
export async function listStuckRefunds(input: {
    readonly page: number;
    readonly pageSize: number;
    readonly now: Date;
}): Promise<{ readonly items: readonly StuckRefund[]; readonly total: number }> {
    const parsed = listInputSchema.safeParse(input);
    if (!parsed.success)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid stuck refund pagination',
            undefined,
            'STUCK_REFUNDS_INPUT_INVALID'
        );
    const { page, pageSize, now } = parsed.data;

    return getDb().transaction(async (tx) => {
        const stuck = and(eq(refunds.status, 'CONFIRMED'), hasLiveProviderCallSql(refunds.id));
        const [{ total = 0 } = {}] = await tx.select({ total: count() }).from(refunds).where(stuck);
        const rows = await tx
            .select({
                refundId: refunds.id,
                amount: refunds.amount,
                paymentId: refunds.paymentId,
                manualPaymentId: refunds.manualPaymentId,
                createdAt: refunds.createdAt,
                currency: payments.currency
            })
            .from(refunds)
            .leftJoin(payments, eq(payments.id, refunds.paymentId))
            .where(stuck)
            .orderBy(asc(refunds.createdAt), asc(refunds.id))
            .limit(pageSize)
            .offset((page - 1) * pageSize);
        const tallies = await readRefundCallTallies({
            db: tx,
            refundIds: rows.map((row) => row.refundId)
        });

        const items = rows.map((row): StuckRefund => {
            const tally = tallies.get(row.refundId);
            const unanswered = tally?.unanswered ?? [];
            const oldest = unanswered.reduce<Date | null>(
                (min, call) => (min === null || call.createdAt < min ? call.createdAt : min),
                null
            );
            return {
                refundId: row.refundId,
                amountMinor: row.amount,
                currency: row.currency,
                createdAt: row.createdAt,
                payment: row.paymentId
                    ? { source: 'PAYMENT', id: row.paymentId }
                    : { source: 'MANUAL_PAYMENT', id: row.manualPaymentId as string },
                providerCallCount: tally?.calls.length ?? 0,
                unansweredCallCount: unanswered.length,
                oldestUnansweredAt: oldest,
                acceptedAmountMinor: tally?.acceptedAmount ?? 0,
                suggestedAction: tally
                    ? suggestStuckRefundAction({ tally, refundAmount: row.amount, now })
                    : null
            };
        });
        return { items, total };
    });
}
