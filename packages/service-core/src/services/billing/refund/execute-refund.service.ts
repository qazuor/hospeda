import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { and, eq, getDb, idempotencyKeys, payments, refundCalls, refunds } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { actStartInstant, assertFreshForAct } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import {
    type ApplyExecutedRefundResult,
    applyExecutedRefund
} from '../payment/apply-executed-refund.service';
import { resolveHungPaymentsBySettlement } from '../reconciliation/hung-payment-resolution';
import { canRefundTransition } from './refund-machine';
import { lockRefundSource } from './refund-source';

const logger = createLogger('execute-refund');

/** The id of a confirmed refund, optionally tied to a notice or sweep. */
export type ExecuteRefundInput = { readonly refundId: string; readonly correlationId?: string };

/** RF3 result; delayed or repeated notices are ordinary outcomes. */
export type ExecuteRefundResult = {
    readonly refundId: string;
    readonly outcome:
        | 'EXECUTED'
        | 'NOT_CONFIRMED'
        | 'NOT_APPLICABLE'
        | 'AWAITING_PROVIDER_ANSWER'
        | 'NOTHING_ACCEPTED'
        | 'NOT_ACCREDITED_KEPT_CONFIRMED'
        | 'REFUND_STATE_CHANGED';
    readonly paymentEffect: ApplyExecutedRefundResult | null;
};

function result(
    input: ExecuteRefundInput,
    outcome: ExecuteRefundResult['outcome'],
    paymentEffect: ApplyExecutedRefundResult | null = null
): ExecuteRefundResult {
    logger.info(
        {
            refundId: input.refundId,
            correlationId: input.correlationId,
            outcome,
            paymentOutcome: paymentEffect?.outcome ?? null
        },
        'RF3 provider reread result'
    );
    return { refundId: input.refundId, outcome, paymentEffect };
}

/**
 * AC:B6:5 / TRANS:B:RF3: execute a confirmed payment refund only after a fresh
 * provider read proves that this row's refund ids are accredited for its exact amount.
 * This service has no production caller until run 5 or HOS-1636.
 *
 * @param input - The refund to inspect.
 * @param ports - The provider and clock.
 * @returns The RF3 outcome and P3/P4 effect, if any.
 * @throws ServiceError NOT_FOUND with reason REFUND_NOT_FOUND for an unknown refund.
 */
export async function executeRefundFromProviderRead(
    input: ExecuteRefundInput,
    ports: { readonly provider: PaymentProvider; readonly clock: Clock }
): Promise<ExecuteRefundResult> {
    const db = getDb();
    const [candidate] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.id, input.refundId))
        .limit(1);
    if (!candidate)
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'Refund not found',
            undefined,
            'REFUND_NOT_FOUND'
        );
    if (candidate.status !== 'CONFIRMED') return result(input, 'NOT_CONFIRMED');
    if (candidate.manualPaymentId || !candidate.paymentId) return result(input, 'NOT_APPLICABLE');
    const paymentId = candidate.paymentId;

    const calls = await db
        .select({
            providerRefundId: refundCalls.providerRefundId,
            addonInstanceId: refundCalls.addonInstanceId,
            completedAt: idempotencyKeys.completedAt,
            result: idempotencyKeys.result
        })
        .from(refundCalls)
        .innerJoin(idempotencyKeys, eq(refundCalls.idempotencyKey, idempotencyKeys.key))
        .where(eq(refundCalls.refundId, input.refundId));
    if (calls.some((call) => call.addonInstanceId !== null)) return result(input, 'NOT_APPLICABLE');
    if (calls.some((call) => call.completedAt === null))
        return result(input, 'AWAITING_PROVIDER_ANSWER');
    const acceptedIds = calls.flatMap((call) =>
        call.providerRefundId === null ? [] : [call.providerRefundId]
    );
    if (acceptedIds.length === 0) return result(input, 'NOTHING_ACCEPTED');

    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!payment) throw new Error('Confirmed refund payment is missing');
    if (payment.addonInstanceId !== null) return result(input, 'NOT_APPLICABLE');

    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readCharge({ chargeId: payment.providerFactId });
    const { snapshot } = assertFreshForAct({ read, act });
    const ownRefunds = acceptedIds.map((id) =>
        snapshot.refunds.find((entry) => entry.refundId === id)
    );
    if (
        ownRefunds.some(
            (entry) => !entry || !entry.accredited || entry.amount.currency !== payment.currency
        ) ||
        ownRefunds.reduce((sum, entry) => sum + (entry?.amount.amountMinor ?? 0), 0) !==
            candidate.amount
    )
        return result(input, 'NOT_ACCREDITED_KEPT_CONFIRMED');

    return db.transaction(async (tx: DrizzleClient) => {
        const locked = await lockRefundSource({
            tx,
            source: { kind: 'PAYMENT', id: paymentId }
        });
        if (locked.kind !== 'PAYMENT') throw new Error('Expected a payment source');
        const [refund] = await tx
            .select()
            .from(refunds)
            .where(eq(refunds.id, input.refundId))
            .limit(1)
            .for('update');
        if (
            !refund ||
            refund.status !== 'CONFIRMED' ||
            refund.version !== candidate.version ||
            refund.paymentId !== paymentId
        )
            return result(input, 'REFUND_STATE_CHANGED');
        if (!canRefundTransition({ transition: 'RF3', from: refund.status }).allowed)
            return result(input, 'REFUND_STATE_CHANGED');
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
        if (!updated) return result(input, 'REFUND_STATE_CHANGED');
        await resolveHungPaymentsBySettlement({
            tx,
            payment: { source: 'PAYMENT', id: locked.payment.id },
            refundId: refund.id,
            at: ports.clock.now()
        });
        const paymentEffect = await applyExecutedRefund(
            { refundId: refund.id },
            { clock: ports.clock, tx }
        );
        return result(input, 'EXECUTED', paymentEffect);
    });
}
