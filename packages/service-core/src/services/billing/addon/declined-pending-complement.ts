import type { Clock } from '@repo/billing-verticals-contract';
import type { SelectSubscription } from '@repo/db';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import type { BillingFactSink } from '../facts/billing-fact-sink';
import { creditedPaymentsFromLedger } from '../payment/payment-ledger';
import { abandonPendingComplementPair, withoutCreditedPayment } from './release-pending-complement';

/**
 * HOS-2668: what S16's pending-signup branch (HOS-1731) does for a PRINCIPAL, applied to a
 * recurring add-on. When a charge of a COMPLEMENTO that is still `PENDING_AUTHORIZATION` is
 * rejected, the pair (the COMPLEMENTO and its addon instance) is released ONLY when the fresh
 * re-read of its preapproval is already `cancelled`: cancelling a live checkout could destroy a
 * successful retry by the payer. So no cancel call is ever made here, and no cancellation
 * decision is recorded (nothing is left for the sweep to retry).
 *
 * A `pending` preapproval leaves both rows exactly as they are (§1.2); the owner's next purchase
 * attempt decides it (A1 reuses its checkout, or releases it on a changed payer email). An
 * `active` or `paused` one is never released. Like S16 it does not depend on whether the charge
 * has a provider retry window: that only decides whether the payment closes (P8), which the
 * caller handles. A credited payment blocks the release, checked before the read and again
 * inside the release transaction.
 *
 * This is `A9` (HOS-2668). No before-cancel notice is asked for: the decline is reported as
 * `addon_charge_declined`, and a committed release also emits `addon_checkout_abandoned`
 * (`CLOSED_BY_SYSTEM`) once. A9 never cancels at the provider, so it records no cancellation
 * decision and needs no before-cancel kind.
 *
 * @param input.subscription - The subscription the rejected charge is linked to
 * @param input.authorizationId - Its provider preapproval
 * @param ports - Provider, clock and the optional fact sink
 * @returns Whether this call released the pair
 * @throws PaymentProviderError when the preapproval could not be read: nothing was written
 */
export async function releaseDeclinedPendingComplement(
    input: { readonly subscription: SelectSubscription; readonly authorizationId: string },
    ports: {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly billingFacts?: BillingFactSink;
    }
): Promise<{ readonly released: boolean }> {
    const { subscription } = input;
    if (subscription.class !== 'COMPLEMENTO' || subscription.status !== 'PENDING_AUTHORIZATION')
        return { released: false };
    if (await creditedPaymentsFromLedger.hasCreditedPayment({ subscriptionId: subscription.id }))
        return { released: false };
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readAuthorization({ authorizationId: input.authorizationId });
    const { snapshot } = assertFreshForAct({ read, act });
    if (snapshot.status !== 'cancelled') return { released: false };
    const released = await abandonPendingComplementPair({
        complementId: subscription.id,
        now: ports.clock.now(),
        actor: { type: 'provider', id: null },
        decidesProviderCancellation: false,
        stillReleasable: withoutCreditedPayment(subscription.id),
        // A9: the checkout died with its declined first charge, closed by the system.
        abandonedFact: {
            reason: 'CLOSED_BY_SYSTEM',
            actorKind: 'SYSTEM',
            billingFacts: ports.billingFacts
        }
    });
    return { released };
}
