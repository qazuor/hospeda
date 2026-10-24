import type { Clock } from '@repo/billing-verticals-contract';
import { eq, getDb, providerLinks, subscriptions } from '@repo/db';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import type { CoverageNotices } from '../payment/payment-ports';
import { activatePendingWithSignupNotice } from './activate-pending-with-signup-notice.js';
import { afterSubscriptionActivated } from './after-activation-commit.js';
import type { TouristVipInheritancePort } from './cancel-inherited-tourist-vip.service';
import { refuseUndeclaredSubscriptionTransition } from './refuse-undeclared-transition.js';
import type { BeforeCancelNotice } from './start-subscription.service';
import type { SuccessionCloser } from './subscription-billing-ports';
import { findSubscriptionProhibition } from './subscription-prohibited-transitions.js';

export interface ActivateSubscriptionPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly touristVipInheritance: TouristVipInheritancePort;
    /** Receives the post-commit S2 notice (B4.2); defaults to the unwired logger. */
    readonly coverageNotices?: CoverageNotices;
    /**
     * S18's interface (B8b), handed to S2 for branch 1 (AC:B7:25): when the
     * activated successor's predecessor holds an S19 retention. Defaults to
     * `unimplementedSuccessionCloser`, which throws.
     */
    readonly successionCloser?: SuccessionCloser;
}

export interface ActivateSubscriptionResult {
    readonly activated: boolean;
    readonly subscriptionId: string;
}

/** S2: only a fresh by-id provider read can authorize a still-pending row. On CANCEL_SCHEDULED/CANCELLED, the attempt falls under core rule 1 (PROH:B:1/2). */
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

    if (
        row &&
        findSubscriptionProhibition({ from: row.subscription.status, to: 'ACTIVE' }) !== null
    ) {
        await refuseUndeclaredSubscriptionTransition({
            subscriptionId,
            to: 'ACTIVE',
            attemptedBy: 'S2',
            actor: { type: 'provider' }
        });
        return { activated: false, subscriptionId };
    }

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

    const activated = await activatePendingWithSignupNotice(
        { subscriptionId, now: ports.clock.now() },
        { successionCloser: ports.successionCloser }
    );
    if (activated) {
        await afterSubscriptionActivated({ subscription: row.subscription }, ports);
    }
    return { activated, subscriptionId };
}
