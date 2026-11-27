import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    type DrizzleClient,
    eq,
    getDb,
    idempotencyKeys,
    providerLinks,
    type SelectAddonInstance,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import {
    actStartInstant,
    assertFreshForAct,
    type PaymentProvider,
    PaymentProviderError,
    ProviderReadRejectedError
} from '@repo/payments';
import type { BillingFactSink } from '../facts/billing-fact-sink';
import type { AddonFactListing } from './addon-fact-emit';
import { releasePendingComplement } from './release-pending-complement';

const logger = createLogger('addon-occupied-recurring-purchase');

/**
 * What a new request does with the same owner's pending recurring purchase (a COMPLEMENTO and its
 * instance) that holds the identity it asks for (HOS-2668), decided like a plan signup's live
 * commitment:
 *
 * - `{ kind: 'REUSE' }`: its preapproval is still pending, the payer email is the same and the
 *   authorization window is open. The caller answers the stored checkout link; nothing is written.
 * - `{ kind: 'RETRY' }`: the payer email changed, the provider cancelled the preapproval, or the
 *   window ended. The pair was released (or another entry moved it meanwhile); the caller retries
 *   the purchase once with the new request.
 * - `{ kind: 'ACTIVATED' }`: the provider reads the preapproval authorized. Nothing is released;
 *   its activation arrives through the notice or the window expiry.
 * - `{ kind: 'UNDECIDED' }`: there is nothing to read yet (no preapproval linked, no stored
 *   link, or a read that is not ours). The caller keeps answering it as pending elsewhere.
 */
export type OccupiedRecurringPurchaseDecision =
    | { readonly kind: 'REUSE'; readonly checkoutUrl: string }
    | { readonly kind: 'RETRY' }
    | { readonly kind: 'ACTIVATED' }
    | { readonly kind: 'UNDECIDED' };

/**
 * Reads the sanitized checkout link a completed recurring creation stored. It lives only in the
 * `PREAPPROVAL_CREATE` key of the COMPLEMENTO.
 *
 * @param input.complementId - The COMPLEMENTO subscription
 * @param input.tx - An optional transaction
 * @returns The stored link, or undefined when none was stored
 */
export async function recurringCheckoutUrlOf(input: {
    readonly complementId: string;
    readonly tx?: DrizzleClient;
}): Promise<string | undefined> {
    const [key] = await (input.tx ?? getDb())
        .select({ result: idempotencyKeys.result })
        .from(idempotencyKeys)
        .where(
            and(
                eq(idempotencyKeys.subjectId, input.complementId),
                eq(idempotencyKeys.operation, 'PREAPPROVAL_CREATE')
            )
        )
        .limit(1);
    const value = key?.result;
    return value &&
        typeof value === 'object' &&
        'checkoutUrl' in value &&
        typeof value.checkoutUrl === 'string'
        ? value.checkoutUrl
        : undefined;
}

/** Whether two declared payer emails differ; an absent one never differs (as S1 compares them). */
function payerEmailChanged(input: {
    readonly declared: string | null;
    readonly requested: string | undefined;
}): boolean {
    const declared = input.declared?.trim().toLowerCase();
    const requested = input.requested?.trim().toLowerCase();
    return Boolean(declared && requested && declared !== requested);
}

/**
 * A read that did not answer, in the shape the purchase route already maps to a retryable 503
 * (`PROVIDER_UNAVAILABLE`, or `PROVIDER_BUSY` on a throttle). A provider refusal of the read
 * itself (not found, rejected) yields `null`: nothing can be decided, and the caller keeps the
 * pre-HOS-2668 answer. Any other failure is rethrown.
 */
function asRetryableFailure(error: unknown): PaymentProviderError | null {
    if (error instanceof PaymentProviderError && (error.transient || error.incompleteRead))
        return new PaymentProviderError({
            code: error.code,
            capability: 'authorize',
            message: 'Could not read the pending addon preapproval',
            cause: error,
            transient: error.transient ?? { kind: 'UNAVAILABLE' }
        });
    if (error instanceof ProviderReadRejectedError)
        return new PaymentProviderError({
            code: 'UNAVAILABLE',
            capability: 'authorize',
            message: 'The pending addon preapproval read was not fresh',
            cause: error,
            transient: { kind: 'UNAVAILABLE' }
        });
    if (error instanceof PaymentProviderError) return null;
    throw error;
}

/**
 * Decides what a new request does with the same owner's pending recurring purchase that holds
 * its identity, so an owner whose checkout was abandoned, declined or must change payer email is
 * never stuck answering "pending elsewhere" for the whole window.
 *
 * The preapproval is re-read by id first (with the freshness rule of S39) and nothing is decided
 * on a read that did not answer. A pending one with the same payer email inside the window is
 * reused without any write or provider call. A changed payer email, a cancelled preapproval or an
 * ended window releases the pair in one transaction and then cancels the preapproval when it is
 * not already cancelled; a failed cancel is left to the sweep. An authorized one is never
 * released.
 *
 * @param input.occupant - The pending instance holding the identity, already scoped to the owner
 * @param input.payerEmail - The payer email the new request declares, if any
 * @param ports - Provider, clock and the optional fact sink and listing reader (A8's fact)
 * @returns The decision
 * @throws PaymentProviderError (capability `authorize`, transient) when the read did not answer:
 *   nothing was written, and the owner retries later
 */
export async function decideOccupiedRecurringPurchase(
    input: { readonly occupant: SelectAddonInstance; readonly payerEmail?: string },
    ports: {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly billingFacts?: BillingFactSink;
        readonly listing?: AddonFactListing;
    }
): Promise<OccupiedRecurringPurchaseDecision> {
    const complementId = input.occupant.complementSubscriptionId;
    if (!complementId) return { kind: 'UNDECIDED' };
    const [row] = await getDb()
        .select({ complement: subscriptions, link: providerLinks })
        .from(subscriptions)
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, complementId))
        .limit(1);
    // Without a linked preapproval the creation is still in flight: the creations sweep and the
    // window expiry resolve it.
    if (!row?.link || row.complement.status !== 'PENDING_AUTHORIZATION')
        return { kind: 'UNDECIDED' };
    const authorizationId = row.link.providerId;

    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    let read: Awaited<ReturnType<PaymentProvider['readAuthorization']>>;
    let status: string;
    try {
        actStartInstant({ act });
        read = await ports.provider.readAuthorization({ authorizationId });
        const fresh = assertFreshForAct({ read, act });
        if (fresh.snapshot.reference !== complementId) {
            logger.error(
                { complementId },
                'Pending addon preapproval read reference did not match the complement'
            );
            return { kind: 'UNDECIDED' };
        }
        status = fresh.snapshot.status;
    } catch (error) {
        const retryable = asRetryableFailure(error);
        if (retryable) throw retryable;
        logger.warn(
            {
                complementId,
                code: error instanceof PaymentProviderError ? error.code : undefined
            },
            'Pending addon preapproval read was refused; the occupant stays pending elsewhere'
        );
        return { kind: 'UNDECIDED' };
    }
    if (status === 'active') return { kind: 'ACTIVATED' };
    if (status !== 'pending' && status !== 'cancelled') return { kind: 'UNDECIDED' };

    const windowEndsAt = row.complement.authorizationWindowEndsAt;
    const windowOpen =
        windowEndsAt !== null && ports.clock.now().getTime() < windowEndsAt.getTime();
    if (
        status === 'pending' &&
        windowOpen &&
        !payerEmailChanged({
            declared: row.complement.declaredPayerEmail,
            requested: input.payerEmail
        })
    ) {
        const checkoutUrl = await recurringCheckoutUrlOf({ complementId });
        return checkoutUrl ? { kind: 'REUSE', checkoutUrl } : { kind: 'UNDECIDED' };
    }

    await releasePendingComplement(
        {
            complementId,
            instanceId: input.occupant.id,
            authorizationId,
            prior: { read, act },
            actor: { type: 'owner', id: input.occupant.ownerId }
        },
        ports
    );
    return { kind: 'RETRY' };
}
