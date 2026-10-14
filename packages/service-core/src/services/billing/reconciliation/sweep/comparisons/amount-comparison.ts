import type { Clock } from '@repo/billing-verticals-contract';
import type { ReconciliationMarkReason } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import {
    actStartInstant,
    assertFreshForAct,
    confirmAuthorizationMutation,
    PaymentProviderError
} from '@repo/payments';
import type { ReconciliationComparison } from '../reconciliation-divergence.js';
import {
    type AmountMutationDecisions,
    noAmountMutationDecisions
} from './amount-mutation-decisions.port.js';
import { createCutExpectedAmountPolicy, type ExpectedAmountPolicy } from './expected-amount.js';

const logger = createLogger('billing-reconciliation-amount');
const AMOUNT_DIVERGENCE = 'DIVERGENCIA_DE_MONTO' as const satisfies ReconciliationMarkReason;
const DAY_MS = 86_400_000;
/** MOT:5 retry window from the transition; this is not a key in the deadlines table. */
export const AMOUNT_MUTATION_RETRY_WINDOW_MS = 3 * DAY_MS;

/** Compares the authorization amount, retrying only mutations recorded as ours (AC:B11:9). */
export function createAmountComparison(ports: {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly expectedAmounts?: ExpectedAmountPolicy;
    readonly mutations?: AmountMutationDecisions;
}): ReconciliationComparison {
    const expectedAmounts = ports.expectedAmounts ?? createCutExpectedAmountPolicy();
    const mutations = ports.mutations ?? noAmountMutationDecisions;
    return async ({ subscription, providerLink, read, act }) => {
        if (
            subscription.status === 'PAUSED' ||
            ['CANCELLED', 'ABANDONED', 'CHARGE_DECLINED'].includes(subscription.status)
        )
            return [];

        const { snapshot } = assertFreshForAct({ read, act });
        if (snapshot.status === 'cancelled') return [];

        const expected = await expectedAmounts.expectedAmount({
            subscription,
            purpose: { kind: 'AUTHORIZATION' }
        });
        if (expected.kind === 'NOT_COMPARABLE') return [];
        if (
            expected.amountMinor === snapshot.amount.amountMinor &&
            expected.currency === snapshot.amount.currency
        )
            return [];

        const decision = await mutations.findLatest({ subscriptionId: subscription.id });
        const actStartedAt = actStartInstant({ act }).at.getTime();
        const retryUntil = decision
            ? decision.decidedAt.getTime() + AMOUNT_MUTATION_RETRY_WINDOW_MS
            : null;
        if (decision && retryUntil !== null && actStartedAt < retryUntil) {
            const amount = { amountMinor: expected.amountMinor, currency: expected.currency };
            try {
                const acknowledgement = await ports.provider.changeAmount({
                    authorizationId: providerLink.providerId,
                    amount
                });
                await confirmAuthorizationMutation({
                    provider: ports.provider,
                    acknowledgement,
                    sent: { amount }
                });
            } catch (error) {
                if (!(error instanceof PaymentProviderError)) throw error;
                logger.warn(
                    { err: error, subscriptionId: subscription.id },
                    'Could not retry our authorization amount mutation'
                );
            }
            return [];
        }

        return [
            {
                reason: AMOUNT_DIVERGENCE,
                detail: [
                    { field: 'reconciliation_mark.expected_minor', new: expected.amountMinor },
                    {
                        field: 'provider.authorization_amount_minor',
                        new: snapshot.amount.amountMinor
                    }
                ]
            }
        ];
    };
}
