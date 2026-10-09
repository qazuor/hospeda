import type { Clock } from '@repo/billing-verticals-contract';
import { eq, getDb, providerLinks, subscriptionModel, subscriptions } from '@repo/db';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';

export interface ActivateSubscriptionPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
}

export interface ActivateSubscriptionResult {
    readonly activated: boolean;
    readonly subscriptionId: string;
}

/** S2: only a fresh by-id provider read can authorize a still-pending row. */
export async function activateSubscription(
    subscriptionId: string,
    ports: ActivateSubscriptionPorts
): Promise<ActivateSubscriptionResult> {
    const [row] = await getDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(subscriptions)
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1);

    if (row?.subscription.status !== 'PENDING_AUTHORIZATION' || !row.providerLink) {
        return { activated: false, subscriptionId };
    }

    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readAuthorization({
        authorizationId: row.providerLink.providerId
    });
    const { snapshot } = assertFreshForAct({ read, act });
    if (snapshot.status !== 'active') return { activated: false, subscriptionId };

    const activated = await subscriptionModel.activatePendingAuthorization({
        subscriptionId,
        now: ports.clock.now()
    });
    return { activated, subscriptionId };
}
