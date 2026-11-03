import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient, SelectPayment, SelectRefund } from '@repo/db';
import { addonInstances, and, eq, getDb, refunds } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { actStartInstant, assertFreshForAct } from '@repo/payments';
import { applyExecutedRefund } from '../payment/apply-executed-refund.service';
import { resolveHungPaymentsBySettlement } from '../reconciliation/hung-payment-resolution';
import type { ExecuteRefundInput, ExecuteRefundResult } from './execute-refund.service';
import { canRefundTransition } from './refund-machine';
import { lockRefundSource } from './refund-source';

type Result = (
    input: ExecuteRefundInput,
    outcome: ExecuteRefundResult['outcome'],
    paymentEffect?: ExecuteRefundResult['paymentEffect']
) => ExecuteRefundResult;

/** Complete TRANS:B:RF3 for an accredited row, preserving the payment transaction. */
export async function executeAccreditedRefund(input: {
    readonly input: ExecuteRefundInput;
    readonly candidate: SelectRefund;
    readonly paymentId: string;
    readonly clock: Clock;
    readonly result: Result;
}): Promise<ExecuteRefundResult> {
    const { candidate, paymentId, clock, result } = input;
    return getDb().transaction(async (tx: DrizzleClient) => {
        const locked = await lockRefundSource({ tx, source: { kind: 'PAYMENT', id: paymentId } });
        if (locked.kind !== 'PAYMENT') throw new Error('Expected a payment source');
        const [refund] = await tx
            .select()
            .from(refunds)
            .where(eq(refunds.id, input.input.refundId))
            .limit(1)
            .for('update');
        if (
            !refund ||
            refund.status !== 'CONFIRMED' ||
            refund.version !== candidate.version ||
            refund.paymentId !== paymentId
        )
            return result(input.input, 'REFUND_STATE_CHANGED');
        if (!canRefundTransition({ transition: 'RF3', from: refund.status }).allowed)
            return result(input.input, 'REFUND_STATE_CHANGED');
        const [updated] = await tx
            .update(refunds)
            .set({
                status: 'EXECUTED',
                executedVia: 'PROVIDER',
                settledBy: null,
                version: refund.version + 1
            })
            .where(
                and(
                    eq(refunds.id, refund.id),
                    eq(refunds.status, 'CONFIRMED'),
                    eq(refunds.version, refund.version)
                )
            )
            .returning({ id: refunds.id });
        if (!updated) return result(input.input, 'REFUND_STATE_CHANGED');
        await resolveHungPaymentsBySettlement({
            tx,
            payment: { source: 'PAYMENT', id: locked.payment.id },
            refundId: refund.id,
            at: clock.now()
        });
        const paymentEffect = await applyExecutedRefund({ refundId: refund.id }, { clock, tx });
        return result(input.input, 'EXECUTED', paymentEffect);
    });
}

/** AC:B6:8 / TRANS:B:RF3: decide an order refund only by this row's accepted ids. No production caller until HOS-1636. */
export async function executeOrderRefund(input: {
    readonly input: ExecuteRefundInput;
    readonly candidate: SelectRefund;
    readonly payment: SelectPayment;
    readonly acceptedIds: readonly string[];
    readonly awaitingProviderAnswer: boolean;
    readonly ports: { readonly provider: PaymentProvider; readonly clock: Clock };
    readonly result: Result;
}): Promise<ExecuteRefundResult> {
    const { candidate, payment, ports, result } = input;
    if (!payment.addonInstanceId) return result(input.input, 'NOT_APPLICABLE');
    const [instance] = await getDb()
        .select({ orderId: addonInstances.providerOrderId })
        .from(addonInstances)
        .where(eq(addonInstances.id, payment.addonInstanceId))
        .limit(1);
    if (!instance?.orderId) return result(input.input, 'NOT_APPLICABLE');
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readOrder({ orderId: instance.orderId });
    const { snapshot } = assertFreshForAct({ read, act });
    if (input.awaitingProviderAnswer) return result(input.input, 'AWAITING_PROVIDER_ANSWER');
    if (input.acceptedIds.length === 0) return result(input.input, 'NOTHING_ACCEPTED');
    const ownRefunds = input.acceptedIds.map((id) =>
        snapshot.refunds.find((entry) => entry.refundId === id)
    );
    if (
        ownRefunds.some((entry) => !entry?.accredited) ||
        ownRefunds.reduce((sum, entry) => sum + (entry?.amountMinor ?? 0), 0) !== candidate.amount
    )
        return result(input.input, 'NOT_ACCREDITED_KEPT_CONFIRMED');
    return executeAccreditedRefund({
        input: input.input,
        candidate,
        paymentId: payment.id,
        clock: ports.clock,
        result
    });
}
