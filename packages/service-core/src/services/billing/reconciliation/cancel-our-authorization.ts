import type { Clock } from '@repo/billing-verticals-contract';
import { createLogger } from '@repo/logger';
import {
    type ActStart,
    type AuthorizationSnapshot,
    actStartInstant,
    assertFreshForAct,
    type PaymentProvider,
    type ProviderRead
} from '@repo/payments';
import type { BeforeCancelNotice } from '../subscription/start-subscription.service.js';

const logger = createLogger('cancel-our-authorization');

/** What one attempt to cancel our provider authorization ended in. */
export type CancelOurAuthorizationOutcome =
    | 'ALREADY_CANCELLED'
    | 'NOTICE_PENDING'
    | 'CALL_FAILED'
    | 'CONFIRMED'
    | 'SENT_UNCONFIRMED';

/** Input of {@link cancelOurAuthorization}. */
export interface CancelOurAuthorizationInput {
    /** The row whose transition already decided the cancellation. */
    readonly subscriptionId: string;
    /** The notice recipient; `null` when the row has none (a receipt tombstone). */
    readonly userId: string | null;
    /** The provider authorization to cancel. */
    readonly authorizationId: string;
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
}

/** Result of {@link cancelOurAuthorization}. */
export interface CancelOurAuthorizationResult {
    readonly outcome: CancelOurAuthorizationOutcome;
}

function errorName(error: unknown): string {
    return error instanceof Error ? error.name : typeof error;
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
 * 2. With a recipient and a notice port, asks for the before-cancel notice:
 *    `NOT_YET_SENT` defers the call; `NO_RECIPIENT`/`DELIVERY_EXHAUSTED` warn and
 *    call anyway. Without a recipient there is no notice, and it never blocks.
 * 3. Calls `cancel`; a failure is logged and reported, never thrown.
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
        const notice = await ports.beforeCancelNotice.beforeCancel({
            subscriptionId: input.subscriptionId,
            userId: input.userId
        });
        if (notice === 'NOT_YET_SENT') return { outcome: 'NOTICE_PENDING' };
        if (notice === 'NO_RECIPIENT' || notice === 'DELIVERY_EXHAUSTED')
            logger.warn(
                { subscriptionId: input.subscriptionId, notice },
                'Before-cancel notice is not deliverable; cancelling anyway'
            );
    }

    try {
        await ports.provider.cancel({ authorizationId: input.authorizationId });
    } catch (error) {
        logger.error(
            {
                subscriptionId: input.subscriptionId,
                authorizationId: input.authorizationId,
                errorName: errorName(error)
            },
            'Our provider authorization could not be cancelled'
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
