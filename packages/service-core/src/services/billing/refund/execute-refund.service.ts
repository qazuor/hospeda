import type { Clock } from '@repo/billing-verticals-contract';
import { eq, getDb, idempotencyKeys, payments, refundCalls, refunds } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { actStartInstant, assertFreshForAct } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import type { ApplyExecutedRefundResult } from '../payment/apply-executed-refund.service';
import { executeAccreditedRefund, executeOrderRefund } from './execute-refund-order';

const logger = createLogger('execute-refund');

function isRejectedResult(value: unknown): boolean {
    return (
        typeof value === 'object' &&
        value !== null &&
        'outcome' in value &&
        value.outcome === 'REJECTED'
    );
}

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
    const acceptedIds = calls.flatMap((call) =>
        call.providerRefundId === null ? [] : [call.providerRefundId]
    );
    const rejectedCount = calls.filter(
        (call) =>
            call.providerRefundId === null &&
            call.completedAt !== null &&
            isRejectedResult(call.result)
    ).length;
    const awaitingProviderAnswer =
        calls.some((call) => call.completedAt === null) ||
        acceptedIds.length + rejectedCount !== calls.length;
    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!payment) throw new Error('Confirmed refund payment is missing');
    if (payment.addonInstanceId !== null)
        return executeOrderRefund({
            input,
            candidate,
            payment,
            acceptedIds,
            awaitingProviderAnswer,
            ports,
            result
        });
    if (calls.some((call) => call.addonInstanceId !== null)) return result(input, 'NOT_APPLICABLE');
    if (!awaitingProviderAnswer && acceptedIds.length === 0)
        return result(input, 'NOTHING_ACCEPTED');

    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readCharge({ chargeId: payment.providerFactId });
    const { snapshot } = assertFreshForAct({ read, act });
    // An unanswered POST may have reached the provider. Read its current state on
    // every notice, but do not execute without ids that identify this row's parts.
    if (awaitingProviderAnswer) return result(input, 'AWAITING_PROVIDER_ANSWER');
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

    return executeAccreditedRefund({ input, candidate, paymentId, clock: ports.clock, result });
}
