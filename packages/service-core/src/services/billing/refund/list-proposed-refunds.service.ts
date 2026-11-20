import {
    and,
    asc,
    count,
    eq,
    getDb,
    inArray,
    or,
    payments,
    RECONCILIATION_MARK_REASON_CATALOG,
    type ReconciliationMarkReason,
    reconciliationMarkPayments,
    reconciliationMarks,
    refundCalls,
    refunds
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { heldByPageChargeMark } from '../addon/one-time-page-charge-marks';
import { noLiveProviderCallSql } from './refund-moved-money';

/** The reconciliation mark behind a proposed refund. */
export type ProposedRefundMark = {
    readonly markId: string;
    readonly reason: ReconciliationMarkReason;
    readonly reasonNumber: number;
    readonly openedAt: Date;
    readonly liftedAt: Date | null;
    readonly subject: {
        readonly kind: 'SUBSCRIPTION' | 'ADDON_INSTANCE';
        readonly id: string;
    };
};

/** One proposed refund still awaiting administrative action 13. */
export type ProposedRefund = {
    readonly refundId: string;
    readonly status: 'REQUESTED' | 'CONFIRMED';
    readonly amountMinor: number;
    readonly currency: string | null;
    readonly requestedAt: Date;
    readonly payment: { readonly source: 'PAYMENT' | 'MANUAL_PAYMENT'; readonly id: string };
    readonly providerCallCount: number;
    readonly closesHeldCharge: boolean;
    readonly marks: readonly ProposedRefundMark[];
};

const listInputSchema = z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100)
});

/**
 * Lists the refunds proposed from a reconciliation mark (`MARK_PROPOSAL`) that wait for a person:
 * `REQUESTED`, plus `CONFIRMED` ones for which {@link noLiveProviderCallSql} is false, the
 * very predicate decline uses: a call the provider accepted or has not answered excludes the refund,
 * while one the provider answered without an id (a rejection kept confirmed) does not. Oldest first. Each
 * item carries the marks that hang its payment, so the operator sees what originated it.
 *
 * @param input.page - One-based page
 * @param input.pageSize - Page size, 1 to 100
 * @returns The page of proposed refunds and the total across pages
 * @throws {ServiceError} VALIDATION_ERROR when the pagination is invalid
 */
export async function listProposedRefunds(input: {
    readonly page: number;
    readonly pageSize: number;
}): Promise<{ readonly items: readonly ProposedRefund[]; readonly total: number }> {
    const parsed = listInputSchema.safeParse(input);
    if (!parsed.success)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid proposed refund pagination',
            undefined,
            'PROPOSED_REFUNDS_INPUT_INVALID'
        );
    const { page, pageSize } = parsed.data;

    return getDb().transaction(async (tx) => {
        // `noLiveProviderCallSql` is the same rule decline applies, so the list and the action
        // cannot disagree; the database filters, counts and paginates.
        const waiting = and(
            eq(refunds.reason, 'MARK_PROPOSAL'),
            or(
                eq(refunds.status, 'REQUESTED'),
                and(eq(refunds.status, 'CONFIRMED'), noLiveProviderCallSql(refunds.id))
            )
        );
        const [{ total = 0 } = {}] = await tx
            .select({ total: count() })
            .from(refunds)
            .where(waiting);
        const rows = await tx
            .select({
                refundId: refunds.id,
                status: refunds.status,
                amount: refunds.amount,
                paymentId: refunds.paymentId,
                manualPaymentId: refunds.manualPaymentId,
                requestedAt: refunds.createdAt,
                currency: payments.currency,
                held: heldByPageChargeMark(refunds.paymentId)
            })
            .from(refunds)
            .leftJoin(payments, eq(payments.id, refunds.paymentId))
            .where(waiting)
            .orderBy(asc(refunds.createdAt), asc(refunds.id))
            .limit(pageSize)
            .offset((page - 1) * pageSize);
        const callCounts = new Map<string, number>();
        if (rows.length > 0) {
            const counted = await tx
                .select({ refundId: refundCalls.refundId, n: count() })
                .from(refundCalls)
                .where(
                    inArray(
                        refundCalls.refundId,
                        rows.map((row) => row.refundId)
                    )
                )
                .groupBy(refundCalls.refundId);
            for (const entry of counted) callCounts.set(entry.refundId, Number(entry.n));
        }

        const cardIds = rows.flatMap((row) => (row.paymentId ? [row.paymentId] : []));
        const manualIds = rows.flatMap((row) => (row.manualPaymentId ? [row.manualPaymentId] : []));
        const markRows =
            cardIds.length + manualIds.length === 0
                ? []
                : await tx
                      .select({
                          paymentId: reconciliationMarkPayments.paymentId,
                          manualPaymentId: reconciliationMarkPayments.manualPaymentId,
                          markId: reconciliationMarks.id,
                          reason: reconciliationMarks.reason,
                          openedAt: reconciliationMarks.placedAt,
                          liftedAt: reconciliationMarks.liftedAt,
                          subscriptionId: reconciliationMarks.subscriptionId,
                          addonInstanceId: reconciliationMarks.addonInstanceId
                      })
                      .from(reconciliationMarkPayments)
                      .innerJoin(
                          reconciliationMarks,
                          eq(reconciliationMarks.id, reconciliationMarkPayments.markId)
                      )
                      .where(
                          or(
                              cardIds.length > 0
                                  ? inArray(reconciliationMarkPayments.paymentId, cardIds)
                                  : undefined,
                              manualIds.length > 0
                                  ? inArray(reconciliationMarkPayments.manualPaymentId, manualIds)
                                  : undefined
                          )
                      )
                      .orderBy(asc(reconciliationMarks.placedAt), asc(reconciliationMarks.id));

        const marksByPayment = new Map<string, ProposedRefundMark[]>();
        for (const row of markRows) {
            const key = row.paymentId
                ? `PAYMENT:${row.paymentId}`
                : `MANUAL_PAYMENT:${row.manualPaymentId}`;
            const reason = row.reason as ReconciliationMarkReason;
            const list = marksByPayment.get(key) ?? [];
            list.push({
                markId: row.markId,
                reason,
                reasonNumber: RECONCILIATION_MARK_REASON_CATALOG[reason].number,
                openedAt: row.openedAt,
                liftedAt: row.liftedAt,
                subject: row.subscriptionId
                    ? { kind: 'SUBSCRIPTION', id: row.subscriptionId }
                    : { kind: 'ADDON_INSTANCE', id: row.addonInstanceId as string }
            });
            marksByPayment.set(key, list);
        }

        const items = rows.map((row): ProposedRefund => {
            const payment = row.paymentId
                ? ({ source: 'PAYMENT', id: row.paymentId } as const)
                : ({ source: 'MANUAL_PAYMENT', id: row.manualPaymentId as string } as const);
            return {
                refundId: row.refundId,
                status: row.status as ProposedRefund['status'],
                amountMinor: row.amount,
                currency: row.currency,
                requestedAt: row.requestedAt,
                payment,
                providerCallCount: callCounts.get(row.refundId) ?? 0,
                // Mirrors decline: a held page charge refuses it while REQUESTED; a CONFIRMED refund
                // with no provider call can be declined (HOS-2179 D1, owner option 1).
                closesHeldCharge: row.held === true && row.status === 'REQUESTED',
                marks: marksByPayment.get(`${payment.source}:${payment.id}`) ?? []
            };
        });
        return { items, total };
    });
}
