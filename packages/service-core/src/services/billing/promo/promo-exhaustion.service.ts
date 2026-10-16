import type { Clock } from '@repo/billing-verticals-contract';
import { and, eq, getDb, promoRedemptions, providerLinks, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import {
    actStartInstant,
    assertFreshForAct,
    confirmAuthorizationMutation,
    type PaymentProvider,
    PaymentProviderError
} from '@repo/payments';
import type { PromoExhaustion } from '../payment/payment-ports.js';
import { recordAmountMutationDecided } from '../reconciliation/sweep/comparisons/amount-mutation-decision.js';
import { createCutExpectedAmountPolicy } from '../reconciliation/sweep/comparisons/expected-amount.js';

const logger = createLogger('promo-exhaustion');

/** Runs S30 after P1 commits the exhausted redemption and returns the provider outcome. */
export async function runS30(
    input: { readonly subscriptionId: string; readonly redemptionId: string },
    ports: { readonly provider: PaymentProvider; readonly clock: Clock }
): Promise<
    | { readonly outcome: 'NOT_APPLICABLE'; readonly reason: string }
    | { readonly outcome: 'MUTATED'; readonly amountMinor: number }
    | { readonly outcome: 'NOT_APPLIED'; readonly amountMinor: number }
> {
    const decision = await getDb().transaction(async (tx) => {
        const [subscription] = await tx
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, input.subscriptionId))
            .limit(1)
            .for('update');
        if (!subscription)
            return { outcome: 'NOT_APPLICABLE' as const, reason: 'SUBSCRIPTION_NOT_FOUND' };
        const [redemption] = await tx
            .select({ id: promoRedemptions.id })
            .from(promoRedemptions)
            .where(
                and(
                    eq(promoRedemptions.id, input.redemptionId),
                    eq(promoRedemptions.subscriptionId, input.subscriptionId),
                    eq(promoRedemptions.remainingCharges, 0)
                )
            )
            .limit(1);
        if (!redemption)
            return { outcome: 'NOT_APPLICABLE' as const, reason: 'REDEMPTION_NOT_EXHAUSTED' };
        if (subscription.status !== 'ACTIVE' && subscription.status !== 'GRACE_PERIOD') {
            if (subscription.status === 'PAUSED')
                logger.info(
                    { ...input },
                    'S30 does not occur on PAUSED; this month remains discounted and nothing is enqueued'
                );
            return { outcome: 'NOT_APPLICABLE' as const, reason: 'SUBSCRIPTION_STATE' };
        }
        if (subscription.paymentMethod !== 'CARD') {
            logger.info({ ...input }, 'S30 requires a card payment method');
            return { outcome: 'NOT_APPLICABLE' as const, reason: 'NO_CARD' };
        }
        const [link] = await tx
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, input.subscriptionId))
            .limit(1);
        if (!link) {
            logger.info({ ...input }, 'S30 has no provider link');
            return { outcome: 'NOT_APPLICABLE' as const, reason: 'NO_PROVIDER_LINK' };
        }
        const decidedAt = ports.clock.now();
        await recordAmountMutationDecided({
            subscriptionId: subscription.id,
            transition: 'S30',
            decidedAt,
            actor: { type: 'provider' },
            correlationId: input.redemptionId,
            changes: [
                { field: 'promo_redemption.remaining_charges', new: 0 },
                {
                    field: 'subscription.transaction_amount',
                    new: 'recalculated_without_exhausted_promo'
                }
            ],
            tx
        });
        return { outcome: 'DECIDED' as const, subscription, authorizationId: link.providerId };
    });
    if (decision.outcome !== 'DECIDED') return decision;
    const expected = await createCutExpectedAmountPolicy().expectedAmount({
        subscription: decision.subscription,
        purpose: { kind: 'AUTHORIZATION' }
    });
    if (expected.kind === 'NOT_COMPARABLE') {
        logger.warn(
            { ...input, reason: expected.reason },
            'S30 decision recorded but amount is not comparable'
        );
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_COMPARABLE' };
    }
    const amount = { amountMinor: expected.amountMinor, currency: expected.currency };
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    try {
        const acknowledgement = await ports.provider.changeAmount({
            authorizationId: decision.authorizationId,
            amount
        });
        const confirmation = await confirmAuthorizationMutation({
            provider: ports.provider,
            acknowledgement,
            sent: { amount }
        });
        assertFreshForAct({ read: confirmation.read, act });
        if (confirmation.outcome === 'applied')
            return { outcome: 'MUTATED', amountMinor: amount.amountMinor };
        logger.warn({ ...input }, 'S30 provider accepted but did not apply amount mutation');
        return { outcome: 'NOT_APPLIED', amountMinor: amount.amountMinor };
    } catch (error) {
        if (!(error instanceof PaymentProviderError)) throw error;
        logger.warn({ ...input, err: error }, 'S30 provider amount mutation failed');
        return { outcome: 'NOT_APPLIED', amountMinor: amount.amountMinor };
    }
}

/** Adapts S30's diagnostic result to P1's best-effort void port. */
export function createPromoExhaustion(ports: {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
}): PromoExhaustion {
    return {
        async runS30(input) {
            await runS30(input, ports);
        }
    };
}
