import type { Clock } from '@repo/billing-verticals-contract';
import { createLogger } from '@repo/logger';
import {
    type ActStart,
    type AuthorizationSnapshot,
    actStartInstant,
    assertFreshForAct,
    type PaymentProvider,
    PaymentProviderError,
    type ProviderRead
} from '@repo/payments';
import type { BeforeCancelNoticeKind } from '../subscription/before-cancel-notice-kinds.js';
import type { BeforeCancelNotice } from '../subscription/start-subscription.service.js';

const logger = createLogger('cancel-our-authorization');

/** What one attempt to cancel our provider authorization ended in. */
export type CancelOurAuthorizationOutcome =
    | 'ALREADY_CANCELLED'
    | 'NOTICE_PENDING'
    | 'CALL_FAILED'
    | 'CONFIRMED'
    | 'SENT_UNCONFIRMED';

/**
 * The notice kinds a cancellation through this helper can ask for (its template is part of the
 * dedupe key). S6's `ARREARS_SUSPENSION` never goes through it: S6 retries itself.
 */
export type CancelOurAuthorizationNoticeKind = Exclude<
    BeforeCancelNoticeKind,
    'ARREARS_SUSPENSION'
>;

/** Input of {@link cancelOurAuthorization}. */
export interface CancelOurAuthorizationInput {
    /** The row whose transition already decided the cancellation. */
    readonly subscriptionId: string;
    /** The notice recipient; `null` when the row has none (a receipt tombstone). */
    readonly userId: string | null;
    /** The provider authorization to cancel. */
    readonly authorizationId: string;
    /**
     * The notice kind the deciding transition asked for; mandatory, there is no default notice
     * (HOS-1683). The notice's template is part of its dedupe key, so a retry must ask with the
     * same kind as the transition did, or it enqueues a second notice and waits for it. `null`
     * only for a row that has no recipient by construction (a receipt tombstone): with a
     * recipient, `null` fails closed. The occurrence is always the default one (the
     * subscription id).
     */
    readonly kind: CancelOurAuthorizationNoticeKind | null;
    /** A read by id the caller already took, with the act it was taken for. */
    readonly prior?: {
        readonly read: ProviderRead<AuthorizationSnapshot>;
        readonly act: ActStart;
    };
}

/** Ports of {@link cancelOurAuthorization}. */
export interface CancelOurAuthorizationPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice?: BeforeCancelNotice;
    /** Waits between cancel attempts; defaults to a real timer (tests inject a no-op). */
    readonly sleep?: (ms: number) => Promise<void>;
}

/**
 * Bounded in-pass retry of the cancel call on a transient provider failure (HOS-1995): a
 * 429 burst or a 5xx is retried a few times with exponential backoff (the provider's
 * `Retry-After` wins, capped), so a throttled sweep does not leave an abandoned preapproval
 * alive until the next day. The cancel PUT is idempotent and the result is re-read after.
 * Beyond these attempts the row stays `CALL_FAILED` and the 3-day retry window of
 * `retryOurCancellation` decides whether later sweeps try again.
 */
export const CANCEL_TRANSIENT_RETRY = {
    maxAttempts: 3,
    baseDelayMs: 2000,
    maxDelayMs: 10000
} as const;

/** Result of {@link cancelOurAuthorization}. */
export interface CancelOurAuthorizationResult {
    readonly outcome: CancelOurAuthorizationOutcome;
}

function errorName(error: unknown): string {
    return error instanceof Error ? error.name : typeof error;
}

function defaultSleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** The HTTP status and sanitized body the adapter attached to a provider error, if any. */
function providerFailureDetail(error: unknown): {
    readonly status?: number;
    readonly body?: unknown;
    readonly code?: string;
    readonly transientKind?: string;
} {
    if (!(error instanceof PaymentProviderError)) return {};
    const cause: unknown = error.cause;
    const record =
        typeof cause === 'object' && cause !== null ? (cause as Record<string, unknown>) : {};
    const status = typeof record.status === 'number' ? record.status : undefined;
    return {
        ...(status === undefined ? {} : { status }),
        ...('body' in record ? { body: record.body } : {}),
        code: error.code,
        ...(error.transient ? { transientKind: error.transient.kind } : {})
    };
}

/** Calls `cancel`, retrying transient provider failures a bounded number of times. */
async function cancelWithTransientRetry(
    input: { readonly authorizationId: string },
    ports: CancelOurAuthorizationPorts
): Promise<{ readonly attempts: number; readonly error?: unknown }> {
    const sleep = ports.sleep ?? defaultSleep;
    for (let attempt = 1; ; attempt++) {
        try {
            await ports.provider.cancel({ authorizationId: input.authorizationId });
            return { attempts: attempt };
        } catch (error) {
            const transient = error instanceof PaymentProviderError ? error.transient : undefined;
            if (!transient || attempt >= CANCEL_TRANSIENT_RETRY.maxAttempts) {
                return { attempts: attempt, error };
            }
            const backoff = Math.min(
                CANCEL_TRANSIENT_RETRY.maxDelayMs,
                CANCEL_TRANSIENT_RETRY.baseDelayMs * 2 ** (attempt - 1)
            );
            const delayMs =
                transient.retryAfterSeconds === undefined
                    ? backoff
                    : Math.min(
                          CANCEL_TRANSIENT_RETRY.maxDelayMs,
                          transient.retryAfterSeconds * 1000
                      );
            logger.warn(
                { attempt, delayMs, ...providerFailureDetail(error) },
                'Retrying provider cancel after a transient failure'
            );
            await sleep(delayMs);
        }
    }
}

async function rereadIsCancelled(
    input: { readonly authorizationId: string },
    ports: CancelOurAuthorizationPorts
): Promise<boolean> {
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readAuthorization({ authorizationId: input.authorizationId });
    const fresh = assertFreshForAct({ read, act });
    return fresh.snapshot.status === 'cancelled';
}

/**
 * Sends the cancellation of a provider authorization that one of OUR transitions
 * already decided (AC:B11:3, and the sweep's retry of AC:B11:6): it is the same
 * act that transition decided, with the notice first and the re-read after (the
 * re-read of S17's rule, not its "if it fails, it does not happen").
 *
 * 1. Re-reads by id first (or checks `prior` is fresh for its act); an
 *    authorization already `cancelled` is not called again. A failed first
 *    read calls nothing and reports `CALL_FAILED` (the sweep retries).
 * 2. With a recipient and a notice port, asks for the before-cancel notice with
 *    `input.kind`: `NOT_YET_SENT` defers the call; `NO_RECIPIENT`/`DELIVERY_EXHAUSTED`
 *    warn and call anyway. A recipient without a kind fails closed: no notice, no call,
 *    `CALL_FAILED` (HOS-1683, never a generic notice). Without a recipient there is no
 *    notice, and it never blocks.
 * 3. Calls `cancel`, retrying a transient failure (429, 5xx) with bounded backoff; a final
 *    failure is logged with its HTTP status and sanitized body and reported, never thrown.
 * 4. Re-reads by id after the call to confirm it.
 *
 * It writes nothing to the database: the caller decides what each outcome means.
 *
 * @param input - The row, its recipient, the authorization and an optional prior read
 * @param ports - Provider, clock and the optional before-cancel notice
 * @returns The outcome of this attempt
 * @throws ProviderReadRejectedError when `prior` predates its act
 */
export async function cancelOurAuthorization(
    input: CancelOurAuthorizationInput,
    ports: CancelOurAuthorizationPorts
): Promise<CancelOurAuthorizationResult> {
    let cancelledBefore: boolean;
    if (input.prior) {
        const fresh = assertFreshForAct({ read: input.prior.read, act: input.prior.act });
        cancelledBefore = fresh.snapshot.status === 'cancelled';
    } else {
        try {
            cancelledBefore = await rereadIsCancelled(input, ports);
        } catch (error) {
            logger.error(
                {
                    subscriptionId: input.subscriptionId,
                    authorizationId: input.authorizationId,
                    errorName: errorName(error)
                },
                'Could not re-read the authorization before cancelling it; nothing was called'
            );
            return { outcome: 'CALL_FAILED' };
        }
    }
    if (cancelledBefore) return { outcome: 'ALREADY_CANCELLED' };

    if (input.userId && ports.beforeCancelNotice) {
        if (input.kind === null) {
            logger.error(
                { subscriptionId: input.subscriptionId },
                'A cancellation with a recipient declared no notice kind; nothing was called'
            );
            return { outcome: 'CALL_FAILED' };
        }
        const notice = await ports.beforeCancelNotice.beforeCancel({
            subscriptionId: input.subscriptionId,
            userId: input.userId,
            kind: input.kind
        });
        if (notice === 'NOT_YET_SENT') return { outcome: 'NOTICE_PENDING' };
        if (notice === 'NO_RECIPIENT' || notice === 'DELIVERY_EXHAUSTED')
            logger.warn(
                { subscriptionId: input.subscriptionId, notice },
                'Before-cancel notice is not deliverable; cancelling anyway'
            );
    }

    const cancelled = await cancelWithTransientRetry(input, ports);
    if (cancelled.error !== undefined) {
        logger.error(
            {
                subscriptionId: input.subscriptionId,
                authorizationId: input.authorizationId,
                errorName: errorName(cancelled.error),
                attempts: cancelled.attempts,
                ...providerFailureDetail(cancelled.error)
            },
            'Our provider authorization could not be cancelled',
            { capture: true }
        );
        return { outcome: 'CALL_FAILED' };
    }

    try {
        const confirmed = await rereadIsCancelled(input, ports);
        return { outcome: confirmed ? 'CONFIRMED' : 'SENT_UNCONFIRMED' };
    } catch (error) {
        logger.warn(
            {
                subscriptionId: input.subscriptionId,
                authorizationId: input.authorizationId,
                errorName: errorName(error)
            },
            'Could not re-read the authorization after cancelling it'
        );
        return { outcome: 'SENT_UNCONFIRMED' };
    }
}
