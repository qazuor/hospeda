import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import type { LiveCommitment } from '@repo/db';
import { getDb, reconciliationInventoryModel, subscriptionModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { cancelOurAuthorization } from '../reconciliation/cancel-our-authorization.js';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision.js';
import { commitmentTaken, previousAttemptInProgress } from './resolve-live-commitment.js';
import type { BeforeCancelNotice } from './start-subscription.service.js';

const logger = createLogger('replace-pending-attempt');

/** Replace an eligible pending signup after a fresh provider read and locked S39 transition. */
export async function replacePendingAttempt(
    input: { readonly commitment: LiveCommitment; readonly userId: string },
    ports: {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly beforeCancelNotice: BeforeCancelNotice;
    }
): Promise<void> {
    const link = input.commitment.providerLink;
    if (!link) throw previousAttemptInProgress();
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readAuthorization({ authorizationId: link.providerId });
    const { snapshot } = assertFreshForAct({ read, act });
    if (snapshot.reference !== input.commitment.subscription.id) {
        logger.error(
            { subscriptionId: input.commitment.subscription.id },
            'Replacement read reference did not match the subscription'
        );
        throw commitmentTaken();
    }
    if (snapshot.status !== 'pending' && snapshot.status !== 'cancelled') throw commitmentTaken();

    const now = ports.clock.now();
    const wrote = await getDb().transaction(async (tx) => {
        const locked = await reconciliationInventoryModel.lockSubscriptionForLink({
            subscriptionId: input.commitment.subscription.id,
            tx
        });
        if (
            locked?.subscription.status !== 'PENDING_AUTHORIZATION' ||
            locked.providerLink?.providerId !== link.providerId
        )
            return false;
        const changed = await subscriptionModel.abandonReplacedPendingAuthorization({
            subscriptionId: input.commitment.subscription.id,
            now,
            tx
        });
        if (!changed.wrote) return false;
        await recordProviderCancellationDecided({
            subscriptionId: input.commitment.subscription.id,
            transition: 'S39',
            decidedAt: now,
            actor: { type: 'owner', id: input.userId },
            correlationId: randomUUID(),
            changes: [{ field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ABANDONED' }],
            tx
        });
        return true;
    });
    if (!wrote) throw previousAttemptInProgress();

    if (snapshot.status === 'pending') {
        const { outcome } = await cancelOurAuthorization(
            {
                subscriptionId: input.commitment.subscription.id,
                userId: input.userId,
                authorizationId: link.providerId,
                kind: 'ATTEMPT_REPLACED',
                prior: { read, act }
            },
            ports
        );
        if (outcome !== 'CONFIRMED' && outcome !== 'ALREADY_CANCELLED')
            logger.warn(
                { subscriptionId: input.commitment.subscription.id, outcome },
                'Replaced authorization cancellation will be retried by the sweep'
            );
    }
}
