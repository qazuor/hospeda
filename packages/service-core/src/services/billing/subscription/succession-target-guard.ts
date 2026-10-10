import type { Clock } from '@repo/billing-verticals-contract';
import {
    type DrizzleClient,
    eq,
    getDb,
    providerLinks,
    reconciliationMarkModel,
    subscriptions
} from '@repo/db';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';

export interface CheckSuccessionTargetInput {
    readonly targetSubscriptionId: string;
    readonly tx?: DrizzleClient;
}
export interface CheckSuccessionTargetPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
}
export type SuccessionTargetDecision =
    | {
          readonly allowed: true;
          readonly basis:
              | 'NO_OPEN_MARK'
              | 'CANCEL_SCHEDULED_CONFIRMED_CANCELLED'
              | 'CARD_SUSPENDED_CONFIRMED_CANCELLED';
      }
    | {
          readonly allowed: false;
          readonly reason:
              | 'TARGET_NOT_FOUND'
              | 'MARKED_NOT_SUCCEEDABLE'
              | 'MARKED_NO_PROVIDER_LINK'
              | 'MARKED_PREAPPROVAL_STILL_LIVE';
      };

/** Read-only S14 guard used by the succession writer to check a marked predecessor. */
export async function checkSuccessionTarget(
    input: CheckSuccessionTargetInput,
    ports: CheckSuccessionTargetPorts
): Promise<SuccessionTargetDecision> {
    const db = input.tx ?? getDb();
    const [row] = await db
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(subscriptions)
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, input.targetSubscriptionId))
        .limit(1);
    if (!row) return { allowed: false, reason: 'TARGET_NOT_FOUND' };
    const marks = await reconciliationMarkModel.listOpen({
        subject: { kind: 'SUBSCRIPTION', subscriptionId: input.targetSubscriptionId },
        tx: db
    });
    if (marks.length === 0) return { allowed: true, basis: 'NO_OPEN_MARK' };

    const { subscription, providerLink } = row;
    const cancelScheduled = subscription.status === 'CANCEL_SCHEDULED';
    const suspendedCard =
        subscription.status === 'SUSPENDED' && subscription.paymentMethod === 'CARD';
    if (!cancelScheduled && !suspendedCard)
        return { allowed: false, reason: 'MARKED_NOT_SUCCEEDABLE' };
    if (!providerLink) return { allowed: false, reason: 'MARKED_NO_PROVIDER_LINK' };
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    try {
        const read = await ports.provider.readAuthorization({
            authorizationId: providerLink.providerId
        });
        const { snapshot } = assertFreshForAct({ read, act });
        if (snapshot.status !== 'cancelled')
            return { allowed: false, reason: 'MARKED_PREAPPROVAL_STILL_LIVE' };
        return {
            allowed: true,
            basis: cancelScheduled
                ? 'CANCEL_SCHEDULED_CONFIRMED_CANCELLED'
                : 'CARD_SUSPENDED_CONFIRMED_CANCELLED'
        };
    } catch {
        return { allowed: false, reason: 'MARKED_PREAPPROVAL_STILL_LIVE' };
    }
}
