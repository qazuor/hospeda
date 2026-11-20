import type { Clock } from '@repo/billing-verticals-contract';
import { eq, getDb, manualPayments, payments, refunds } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { type Actor, ServiceError } from '../../../types';
import { type ExecuteRefundResult, executeRefundFromProviderRead } from './execute-refund.service';
import { authorizeRefundAction, readRefundSubject } from './refund-action-authorization';
import { readRefundCallTally } from './refund-call-tally';
import { providerRefundWindow } from './refund-window';
import {
    type ResendRefundCallOutcome,
    resendUnansweredRefundCalls
} from './resend-refund-call.service';

const logger = createLogger('retry-refund-provider-calls');

/** Every `reason` a rejection of `retryRefundProviderCalls` carries, for an exhaustive HTTP mapping. */
export const RETRY_REFUND_PROVIDER_CALLS_REJECTIONS = [
    'REFUND_NOT_FOUND',
    'REFUND_SOURCE_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'REFUND_NOT_CONFIRMED',
    'REFUND_SOURCE_NOT_PROVIDER_REFUNDABLE',
    'REFUND_HAS_NO_UNANSWERED_CALL',
    'REFUND_PAST_PROVIDER_WINDOW',
    'REFUND_STATE_CHANGED'
] as const;

/** A rejection reason of `retryRefundProviderCalls`. */
export type RetryRefundProviderCallsRejection =
    (typeof RETRY_REFUND_PROVIDER_CALLS_REJECTIONS)[number];

/** Input of the retry (HOS-2516). */
export type RetryRefundProviderCallsInput = {
    readonly actor: Actor;
    /** The `CONFIRMED` refund with at least one provider call left unanswered. */
    readonly refundId: string;
    readonly correlationId?: string;
};

/** Result of the retry, consumed by the administrative route. */
export type RetryRefundProviderCallsResult = {
    readonly refundId: string;
    readonly subjectId: string | null;
    /** The refund's status after the resend and, when it ran, RF3. */
    readonly status: 'CONFIRMED' | 'EXECUTED' | 'FAILED';
    /** One entry per resent call, each under its original idempotency key. */
    readonly calls: readonly ResendRefundCallOutcome[];
    /** RF3's outcome when it ran right after the resend; null when it did not run or its read failed. */
    readonly execution: ExecuteRefundResult['outcome'] | null;
};

/** Ports of the retry. */
export type RetryRefundProviderCallsPorts = {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
};

function reject(
    code: ServiceErrorCode,
    message: string,
    reason: RetryRefundProviderCallsRejection
): ServiceError {
    return new ServiceError(code, message, undefined, reason);
}

/**
 * Decides, in the error contract's order, whether this refund's unanswered calls may be resent:
 * 404 missing refund or source → 403 administrative action 13 on the payer → 409/422 business.
 * Holds no lock across the provider call: the resend re-reads the refund and replays each call
 * under its own idempotency key, so a second retry or a late answer converge on one refund.
 */
async function assertRetryable(input: RetryRefundProviderCallsInput, clock: Clock) {
    return getDb().transaction(async (tx) => {
        const [refund] = await tx
            .select()
            .from(refunds)
            .where(eq(refunds.id, input.refundId))
            .limit(1);
        if (!refund)
            throw reject(ServiceErrorCode.NOT_FOUND, 'Refund not found', 'REFUND_NOT_FOUND');
        const [payment] = refund.paymentId
            ? await tx.select().from(payments).where(eq(payments.id, refund.paymentId)).limit(1)
            : [];
        const [manual] =
            !refund.paymentId && refund.manualPaymentId
                ? await tx
                      .select({ subscriptionId: manualPayments.subscriptionId })
                      .from(manualPayments)
                      .where(eq(manualPayments.id, refund.manualPaymentId))
                      .limit(1)
                : [];
        if (!payment && !manual)
            throw reject(
                ServiceErrorCode.NOT_FOUND,
                'Refund source not found',
                'REFUND_SOURCE_NOT_FOUND'
            );
        const subjectId = await readRefundSubject({
            tx,
            subscriptionId: payment ? payment.subscriptionId : (manual?.subscriptionId ?? null),
            addonInstanceId: payment?.addonInstanceId ?? null
        });
        authorizeRefundAction({ actor: input.actor, subjectId });
        if (refund.status !== 'CONFIRMED')
            throw reject(
                ServiceErrorCode.ALREADY_EXISTS,
                `Refund is ${refund.status}, not CONFIRMED`,
                'REFUND_NOT_CONFIRMED'
            );
        if (!payment)
            throw reject(
                ServiceErrorCode.ALREADY_EXISTS,
                'A manual payment refund has no provider call to retry',
                'REFUND_SOURCE_NOT_PROVIDER_REFUNDABLE'
            );
        // A call tied to an add-on instance belongs to the retired order channel: the resend never
        // replays it (HOS-2179 T-7), so it does not count as something this action can retry.
        // Only a call with no stored answer is replayed (the resend's own rule), so the tally's
        // broader `awaitingProviderAnswer` is not the test here.
        const { calls } = await readRefundCallTally({ db: tx, refundId: refund.id });
        const unanswered = calls.filter(
            (call) => call.completedAt === null && call.addonInstanceId === null
        );
        if (unanswered.length === 0)
            throw reject(
                ServiceErrorCode.ALREADY_EXISTS,
                'The refund has no provider call left unanswered',
                'REFUND_HAS_NO_UNANSWERED_CALL'
            );
        // Past the window the provider refuses any refund call, so a refusal would no longer say
        // whether the first, unanswered call moved money; failing the refund on it could hide a
        // refund that did leave. The runbook (§7, case b) checks the panel by hand instead.
        if (!providerRefundWindow({ factAt: payment.factAt, now: clock.now() }).open)
            throw reject(
                ServiceErrorCode.VALIDATION_ERROR,
                'The provider only accepts refunds within 180 days of the charge; check the provider panel by hand (refunds runbook §7, case b)',
                'REFUND_PAST_PROVIDER_WINDOW'
            );
        return { subjectId };
    });
}

/**
 * RF3 right after a resend in which the provider answered every call with an accepted refund.
 * RF3 reads the charge and executes only what the read reports accredited (accepted is not
 * accredited), so running it early never marks money that did not land. It must run here: when
 * the first call's response was lost, the provider already sent its notice and RF3 ran on it
 * while the call was unanswered, so no further notice may come for this refund.
 */
async function executeAfterResend(input: {
    readonly refundId: string;
    readonly correlationId?: string;
    readonly calls: readonly ResendRefundCallOutcome[];
    readonly ports: RetryRefundProviderCallsPorts;
}): Promise<ExecuteRefundResult['outcome'] | null> {
    if (input.calls.length === 0 || input.calls.some((call) => call.outcome !== 'SENT'))
        return null;
    try {
        const executed = await executeRefundFromProviderRead(
            {
                refundId: input.refundId,
                ...(input.correlationId ? { correlationId: input.correlationId } : {})
            },
            input.ports
        );
        return executed.outcome;
    } catch (error) {
        // The resend is already recorded; a failed read leaves the refund CONFIRMED with every
        // call answered, which the next provider notice executes.
        logger.error(error, 'RF3 after a refund call resend failed', { capture: true });
        return null;
    }
}

/**
 * HOS-2516 — "Retry with MP" over a `CONFIRMED` payment refund stuck on a provider call that went
 * unanswered (timeout, 5xx or empty body). It belongs to administrative action 13 (the action
 * that sent the call), so it is authorized like confirming, against the payer as subject. Each
 * unanswered call is sent again by {@link resendUnansweredRefundCalls} with its original body and
 * idempotency key; when every one comes back accepted, RF3 runs at once (see executeAfterResend).
 *
 * @param input - The actor and the refund.
 * @param ports - The payment provider and the clock.
 * @returns The per-call outcomes, the refund's status and RF3's outcome.
 * @throws ServiceError with a reason from {@link RETRY_REFUND_PROVIDER_CALLS_REJECTIONS}.
 */
export async function retryRefundProviderCalls(
    input: RetryRefundProviderCallsInput,
    ports: RetryRefundProviderCallsPorts
): Promise<RetryRefundProviderCallsResult> {
    const { subjectId } = await assertRetryable(input, ports.clock);
    const resent = await resendUnansweredRefundCalls(
        {
            refundId: input.refundId,
            ...(input.correlationId ? { correlationId: input.correlationId } : {})
        },
        ports
    );
    // The resend re-reads the refund: no outcome means it stopped being CONFIRMED in between.
    if (resent.outcomes.length === 0)
        throw reject(
            ServiceErrorCode.ALREADY_EXISTS,
            'Refund changed before its calls were resent',
            'REFUND_STATE_CHANGED'
        );
    const execution = await executeAfterResend({
        refundId: input.refundId,
        correlationId: input.correlationId,
        calls: resent.outcomes,
        ports
    });
    const [after] = await getDb()
        .select({ status: refunds.status })
        .from(refunds)
        .where(eq(refunds.id, input.refundId))
        .limit(1);
    const status = after?.status;
    return {
        refundId: input.refundId,
        subjectId,
        status: status === 'EXECUTED' || status === 'FAILED' ? status : 'CONFIRMED',
        calls: resent.outcomes,
        execution
    };
}
