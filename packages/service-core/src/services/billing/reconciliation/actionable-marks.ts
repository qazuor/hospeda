import {
    addonInstances,
    and,
    asc,
    billingOptions,
    count,
    type DomainEventChange,
    eq,
    getDb,
    inArray,
    isNull,
    manualPayments,
    payments,
    RECONCILIATION_MARK_REASON_CATALOG,
    type ReconciliationMarkDefaultProposal,
    type ReconciliationMarkReason,
    reconciliationMarkPayments,
    reconciliationMarks,
    sql,
    subscriptions
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { readAnchoredBillingOption } from '../read-anchored-billing-option.js';

/** A payment attached to a reconciliation mark, with its live ledger status and amount. */
export type ReconciliationMarkHungPayment = {
    readonly source: 'PAYMENT' | 'MANUAL_PAYMENT';
    readonly paymentId: string;
    readonly amountMinor: number | null;
    readonly currency: string | null;
    readonly status: string;
    readonly hungAt: Date;
    readonly resolvedAt: Date | null;
};

/** One open reconciliation mark and the evidence needed to act on its catalog proposal. */
export type ActionableReconciliationMark = {
    readonly markId: string;
    readonly reason: ReconciliationMarkReason;
    readonly reasonNumber: number;
    readonly refundConfirmation: boolean;
    readonly defaultProposal: ReconciliationMarkDefaultProposal;
    readonly openedAt: Date;
    readonly subject: {
        readonly kind: 'SUBSCRIPTION' | 'ADDON_INSTANCE';
        readonly id: string;
        readonly status: string;
    };
    readonly payments: readonly ReconciliationMarkHungPayment[];
    readonly paymentCount: number;
    readonly totalAmount: readonly { readonly currency: string; readonly amountMinor: number }[];
    readonly unknownAmountCount: number;
    readonly eventLink: { readonly markId: string } | null;
};

/** One critical event belonging to a mark, including a recorded late-payment condition when present. */
export type ReconciliationMarkEventEntry = {
    readonly eventId: string;
    readonly occurredAt: Date;
    readonly actorType: string;
    readonly actorId: string | null;
    readonly correlationId: string;
    readonly outcome: string | null;
    readonly failedCondition: 1 | 2 | 3 | 4 | null;
    readonly conditionRecorded: boolean;
    readonly changes: readonly DomainEventChange[];
};

const listInputSchema = z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100)
});

function invalidInput(): ServiceError {
    return new ServiceError(
        ServiceErrorCode.VALIDATION_ERROR,
        'Invalid actionable reconciliation mark pagination',
        undefined,
        'ACTIONABLE_RECONCILIATION_MARKS_INPUT_INVALID'
    );
}

/** Resolves the catalog number, refund ordering flag, proposal, and optional event link for a mark. */
export function actionableReconciliationMarkMetadata(
    reason: ReconciliationMarkReason,
    markId: string
): Pick<
    ActionableReconciliationMark,
    'reasonNumber' | 'refundConfirmation' | 'defaultProposal' | 'eventLink'
> {
    const catalog = RECONCILIATION_MARK_REASON_CATALOG[reason];
    const reasonSeven = Object.entries(RECONCILIATION_MARK_REASON_CATALOG).find(
        ([, metadata]) => metadata.number === 7
    )?.[0];
    let eventLink: { readonly markId: string } | null = null;
    switch (reason) {
        case reasonSeven:
            eventLink = { markId };
            break;
    }
    return {
        reasonNumber: catalog.number,
        refundConfirmation: catalog.refundConfirmation,
        defaultProposal: catalog.defaultProposal,
        eventLink
    };
}

/** Lists open reconciliation marks with real subject state, all hung payments, and catalog defaults. */
export async function listActionableReconciliationMarks(input: {
    readonly page: number;
    readonly pageSize: number;
}): Promise<{ readonly items: readonly ActionableReconciliationMark[]; readonly total: number }> {
    const parsed = listInputSchema.safeParse(input);
    if (!parsed.success) throw invalidInput();
    const { page, pageSize } = parsed.data;

    return getDb().transaction(async (tx) => {
        const refundReasons = Object.entries(RECONCILIATION_MARK_REASON_CATALOG)
            .filter(([, catalog]) => catalog.refundConfirmation)
            .map(([reason]) => reason);
        const refundOrder = sql`CASE WHEN ${inArray(reconciliationMarks.reason, refundReasons)} THEN 0 ELSE 1 END`;
        const open = isNull(reconciliationMarks.liftedAt);
        const [{ total = 0 } = {}] = await tx
            .select({ total: count() })
            .from(reconciliationMarks)
            .where(open);
        const pageRows = await tx
            .select({
                markId: reconciliationMarks.id,
                reason: reconciliationMarks.reason,
                openedAt: reconciliationMarks.placedAt,
                subscriptionId: reconciliationMarks.subscriptionId,
                subscriptionStatus: subscriptions.status,
                addonInstanceId: reconciliationMarks.addonInstanceId,
                addonStatus: addonInstances.status
            })
            .from(reconciliationMarks)
            .leftJoin(subscriptions, eq(subscriptions.id, reconciliationMarks.subscriptionId))
            .leftJoin(addonInstances, eq(addonInstances.id, reconciliationMarks.addonInstanceId))
            .where(open)
            .orderBy(refundOrder, asc(reconciliationMarks.placedAt), asc(reconciliationMarks.id))
            .limit(pageSize)
            .offset((page - 1) * pageSize);

        const markIds = pageRows.map((row) => row.markId);
        const paymentRows = markIds.length
            ? await tx
                  .select({
                      id: reconciliationMarkPayments.id,
                      markId: reconciliationMarkPayments.markId,
                      paymentId: reconciliationMarkPayments.paymentId,
                      manualPaymentId: reconciliationMarkPayments.manualPaymentId,
                      hungAt: reconciliationMarkPayments.hungAt,
                      resolvedAt: reconciliationMarkPayments.resolvedAt,
                      amount: payments.amount,
                      currency: payments.currency,
                      paymentStatus: payments.status,
                      manualStatus: manualPayments.status,
                      planVersionId: subscriptions.planVersionId,
                      billingOptionId: subscriptions.billingOptionId
                  })
                  .from(reconciliationMarkPayments)
                  .leftJoin(payments, eq(payments.id, reconciliationMarkPayments.paymentId))
                  .leftJoin(
                      manualPayments,
                      eq(manualPayments.id, reconciliationMarkPayments.manualPaymentId)
                  )
                  .leftJoin(subscriptions, eq(subscriptions.id, manualPayments.subscriptionId))
                  .where(inArray(reconciliationMarkPayments.markId, markIds))
                  .orderBy(
                      asc(reconciliationMarkPayments.hungAt),
                      asc(reconciliationMarkPayments.id)
                  )
            : [];

        const paymentByMark = new Map<string, ReconciliationMarkHungPayment[]>();
        for (const row of paymentRows) {
            let amountMinor: number | null = row.amount;
            let currency: string | null = row.currency;
            let status = row.paymentStatus;
            let source: ReconciliationMarkHungPayment['source'] = 'PAYMENT';
            const paymentId = row.paymentId ?? row.manualPaymentId;
            if (row.manualPaymentId) {
                source = 'MANUAL_PAYMENT';
                status = row.manualStatus;
                amountMinor = null;
                currency = null;
                if (row.planVersionId && row.billingOptionId) {
                    const option = await readAnchoredBillingOption({
                        subscription: {
                            planVersionId: row.planVersionId,
                            billingOptionId: row.billingOptionId
                        },
                        reader: {
                            async findByVersionAndId({ planVersionId, billingOptionId }) {
                                const [anchored] = await tx
                                    .select({
                                        id: billingOptions.id,
                                        planVersionId: billingOptions.planVersionId,
                                        cycle: billingOptions.cycle,
                                        amount: billingOptions.amount,
                                        currency: billingOptions.currency
                                    })
                                    .from(billingOptions)
                                    .where(
                                        and(
                                            eq(billingOptions.planVersionId, planVersionId),
                                            eq(billingOptions.id, billingOptionId)
                                        )
                                    )
                                    .limit(1);
                                return anchored ?? null;
                            }
                        }
                    });
                    amountMinor = option?.amount ?? null;
                    currency = option?.currency ?? null;
                }
            }
            const payment: ReconciliationMarkHungPayment = {
                source,
                paymentId: paymentId as string,
                amountMinor,
                currency,
                status: status as string,
                hungAt: row.hungAt,
                resolvedAt: row.resolvedAt
            };
            const list = paymentByMark.get(row.markId) ?? [];
            list.push(payment);
            paymentByMark.set(row.markId, list);
        }

        const items = pageRows.map((row): ActionableReconciliationMark => {
            const reason = row.reason as ReconciliationMarkReason;
            const metadata = actionableReconciliationMarkMetadata(reason, row.markId);
            const markPayments = paymentByMark.get(row.markId) ?? [];
            const totals = new Map<string, number>();
            let unknownAmountCount = 0;
            for (const payment of markPayments) {
                if (payment.amountMinor === null || payment.currency === null) {
                    unknownAmountCount++;
                    continue;
                }
                totals.set(
                    payment.currency,
                    (totals.get(payment.currency) ?? 0) + payment.amountMinor
                );
            }
            if (row.subscriptionId)
                return {
                    markId: row.markId,
                    reason,
                    reasonNumber: metadata.reasonNumber,
                    refundConfirmation: metadata.refundConfirmation,
                    defaultProposal: metadata.defaultProposal,
                    openedAt: row.openedAt,
                    subject: {
                        kind: 'SUBSCRIPTION',
                        id: row.subscriptionId,
                        status: row.subscriptionStatus as string
                    },
                    payments: markPayments,
                    paymentCount: markPayments.length,
                    totalAmount: [...totals].map(([currency, amountMinor]) => ({
                        currency,
                        amountMinor
                    })),
                    unknownAmountCount,
                    eventLink: metadata.eventLink
                };
            return {
                markId: row.markId,
                reason,
                reasonNumber: metadata.reasonNumber,
                refundConfirmation: metadata.refundConfirmation,
                defaultProposal: metadata.defaultProposal,
                openedAt: row.openedAt,
                subject: {
                    kind: 'ADDON_INSTANCE',
                    id: row.addonInstanceId as string,
                    status: row.addonStatus as string
                },
                payments: markPayments,
                paymentCount: markPayments.length,
                totalAmount: [...totals].map(([currency, amountMinor]) => ({
                    currency,
                    amountMinor
                })),
                unknownAmountCount,
                eventLink: metadata.eventLink
            };
        });
        return { items, total };
    });
}
