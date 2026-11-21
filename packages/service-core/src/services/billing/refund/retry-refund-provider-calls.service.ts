import type { Clock } from '@repo/billing-verticals-contract';
import { eq, getDb, manualPayments, payments, refunds } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import type { Pool } from 'pg';
import { type Actor, ServiceError } from '../../../types';
import { type ExecuteRefundResult, executeRefundFromProviderRead } from './execute-refund.service';
import { authorizeRefundAction, readRefundSubject } from './refund-action-authorization';
import { readRefundCallTally } from './refund-call-tally';
import { settleRefundRejectedAfterAcceptance } from './refund-rejected-after-acceptance';
import { providerRefundWindow } from './refund-window';
import {
    type ResendRefundCallOutcome,
    resendUnansweredRefundCalls
} from './resend-refund-call.service';

const logger = createLogger('retry-refund-provider-calls');

/**
 * How long after a call was sent "Retry with MP" may still resend it (owner decision on #4643,
 * HOS-2516). The resend reads the charge first, but a provider read that lags behind a refund it
 * already made, combined with a provider that has forgotten the idempotency key, could still post
 * a second refund (matrix row EX-73, `UNKNOWN`). Inside 24 hours the key is the cover; past it,
 * the operator settles through the panel (action 14 / remainder settlement) instead. This limit
 * can be relaxed once EX-73 is measured.
 */
export const REFUND_CALL_RETRY_LIMIT_MS = 24 * 60 * 60 * 1000;

/** Every `reason` a rejection of `retryRefundProviderCalls` carries, for an exhaustive HTTP mapping. */
export const RETRY_REFUND_PROVIDER_CALLS_REJECTIONS = [
    'REFUND_NOT_FOUND',
    'REFUND_SOURCE_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'REFUND_NOT_CONFIRMED',
    'REFUND_SOURCE_NOT_PROVIDER_REFUNDABLE',
    'REFUND_HAS_NO_UNANSWERED_CALL',
    'REFUND_PAST_PROVIDER_WINDOW',
    'REFUND_CALL_TOO_OLD_TO_RETRY',
    'REFUND_STATE_CHANGED',
    'REFUND_RETRY_IN_PROGRESS'
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
    /**
     * One entry per unanswered call, each under its original idempotency key. Empty when every
     * call was already accepted and the retry only ran RF3 again.
     */
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
 * What the retry does: resend the unanswered calls, or (every call already accepted, nothing
 * unanswered) only run RF3 again, which reads the charge itself.
 */
type RetryMode = 'RESEND' | 'REEXECUTE';

/**
 * Decides, in the error contract's order, whether this refund may be retried and how:
 * 404 missing refund or source → 403 administrative action 13 on the payer → 409/422 business.
 * Its transaction ends before any provider I/O; concurrency is handled by {@link withRetryClaim}.
 */
async function assertRetryable(
    input: RetryRefundProviderCallsInput,
    clock: Clock
): Promise<{ readonly subjectId: string | null; readonly mode: RetryMode }> {
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
        const tally = await readRefundCallTally({ db: tx, refundId: refund.id });
        const { calls } = tally;
        const unanswered = calls.filter(
            (call) => call.completedAt === null && call.addonInstanceId === null
        );
        // HOS-2516 review: a refund with nothing left to answer and at least one accepted call,
        // whose read did not show it accredited (accepted is not accredited), has no other admin
        // exit: RF3 runs again and decides on the amounts. A call refused on the way (lie M13, the
        // first partial refund) does not block it.
        if (
            unanswered.length === 0 &&
            !tally.awaitingProviderAnswer &&
            tally.acceptedIds.length > 0
        )
            return { subjectId, mode: 'REEXECUTE' };
        if (unanswered.length === 0)
            throw reject(
                ServiceErrorCode.ALREADY_EXISTS,
                'The refund has no provider call left unanswered',
                'REFUND_HAS_NO_UNANSWERED_CALL'
            );
        // HOS-2516, owner decision: no resend of a call sent more than 24 hours ago, before any
        // provider I/O (see REFUND_CALL_RETRY_LIMIT_MS). The 180-day window below stays: it is not
        // subsumed, since a call sent on day 179 and retried on day 180 is inside 24 hours and
        // still past the window, and its refusal sends the operator to a different runbook case.
        const oldestSentAt = Math.min(...unanswered.map((call) => call.createdAt.getTime()));
        if (clock.now().getTime() - oldestSentAt > REFUND_CALL_RETRY_LIMIT_MS)
            throw reject(
                ServiceErrorCode.ALREADY_EXISTS,
                'The unanswered call was sent more than 24 hours ago; settle the refund through the provider panel (action 14 or the remainder settlement)',
                'REFUND_CALL_TOO_OLD_TO_RETRY'
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
        return { subjectId, mode: 'RESEND' };
    });
}

/** Namespace of the per-refund retry lock, hashed with the refund id like the cron locks. */
const RETRY_LOCK_PREFIX = 'refund-retry:';

/**
 * Single-flight per refund (HOS-2516 review): a second retry of the same refund while one runs
 * (a double click, two admins) is refused with `REFUND_RETRY_IN_PROGRESS` instead of racing the
 * first one into a false `PROVIDER_REFUND_ALREADY_CITED`.
 *
 * Why a session advisory lock on a dedicated connection: the work spans provider I/O, and a
 * transaction (`FOR UPDATE`, `pg_advisory_xact_lock`) must not stay open across it. The session
 * lock holds one idle pool connection for the retry's duration and no transaction. It needs no
 * schema change, and unlike a claim row it cannot go stale: if the process dies, the connection
 * closes and PostgreSQL drops the lock. Same mechanism as `apps/api/src/cron/cron-lock.ts`.
 */
async function withRetryClaim<T>(refundId: string, run: () => Promise<T>): Promise<T> {
    const pool = (getDb() as ReturnType<typeof getDb> & { readonly $client: Pool }).$client;
    const client = await pool.connect();
    let destroyClient = false;
    try {
        const lock = await client.query<{ readonly acquired: boolean }>(
            'SELECT pg_try_advisory_lock(hashtext($1 || $2)::bigint) AS acquired',
            [RETRY_LOCK_PREFIX, refundId]
        );
        if (lock.rows[0]?.acquired !== true)
            throw reject(
                ServiceErrorCode.ALREADY_EXISTS,
                'Another retry of this refund is running',
                'REFUND_RETRY_IN_PROGRESS'
            );
        try {
            return await run();
        } finally {
            try {
                await client.query('SELECT pg_advisory_unlock(hashtext($1 || $2)::bigint)', [
                    RETRY_LOCK_PREFIX,
                    refundId
                ]);
            } catch {
                // A connection whose unlock failed may still hold the lock: never reuse it.
                destroyClient = true;
            }
        }
    } finally {
        client.release(destroyClient);
    }
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
    readonly mode: RetryMode;
    readonly ports: RetryRefundProviderCallsPorts;
}): Promise<ExecuteRefundResult['outcome'] | null> {
    if (
        input.mode === 'RESEND' &&
        (input.calls.length === 0 ||
            input.calls.some(
                (call) => call.outcome !== 'SENT' && call.outcome !== 'FOUND_AT_PROVIDER'
            ))
    )
        return null;
    try {
        // HOS-2516, owner decision: an accepted call whose refund the provider now reads rejected
        // is recorded as a provider rejection, and a refund left with nothing live fails (RF5),
        // before RF3 would keep it CONFIRMED for ever.
        const rejected = await settleRefundRejectedAfterAcceptance(
            {
                refundId: input.refundId,
                ...(input.correlationId ? { correlationId: input.correlationId } : {})
            },
            input.ports
        );
        if (rejected.outcome === 'FAILED') return null;
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
 * unanswered call goes through {@link resendUnansweredRefundCalls}, which reads the charge first
 * and only posts again when the lost call did not land; when every call ends accepted, RF3 runs
 * at once (see executeAfterResend). A refund with every call already accepted and nothing
 * unanswered only runs RF3 again. One retry per refund at a time ({@link withRetryClaim}).
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
    return withRetryClaim(input.refundId, () => runRetry(input, ports));
}

async function runRetry(
    input: RetryRefundProviderCallsInput,
    ports: RetryRefundProviderCallsPorts
): Promise<RetryRefundProviderCallsResult> {
    const { subjectId, mode } = await assertRetryable(input, ports.clock);
    const calls =
        mode === 'REEXECUTE'
            ? []
            : (
                  await resendUnansweredRefundCalls(
                      {
                          refundId: input.refundId,
                          ...(input.correlationId ? { correlationId: input.correlationId } : {})
                      },
                      ports
                  )
              ).outcomes;
    // The resend re-reads the refund: no outcome means it stopped being CONFIRMED in between.
    if (mode === 'RESEND' && calls.length === 0)
        throw reject(
            ServiceErrorCode.ALREADY_EXISTS,
            'Refund changed before its calls were resent',
            'REFUND_STATE_CHANGED'
        );
    const execution = await executeAfterResend({
        refundId: input.refundId,
        correlationId: input.correlationId,
        calls,
        mode,
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
        calls,
        execution
    };
}
