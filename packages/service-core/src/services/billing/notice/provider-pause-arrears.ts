import { randomUUID } from 'node:crypto';
import { eq, getDb, providerLinks, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct } from '@repo/payments';
import { z } from 'zod';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service.js';
import {
    arrearsPauseDecision,
    type GraceExpiryCheckPorts,
    graceExpiredOccurrenceId,
    runArrearsDecisionAfterPeriodRead
} from '../reconciliation/sweep/grace-expiry-check.js';
import { isLiveSuccessionPredecessor } from '../subscription/late-payment-conditions.js';
import { openSuccessionRetentions } from '../subscription/succession-retained-payment.js';

const logger = createLogger('provider-pause-arrears');
const inputSchema = z.strictObject({ subscriptionId: z.uuid(), readAt: z.date() });

/** Input shared by the provider pause and expired-grace receiver paths. */
export interface ProviderPauseArrearsInput {
    /** Subscription identified by the provider link. */
    readonly subscriptionId: string;
    /** Timestamp of the receiver's provider read. */
    readonly readAt: Date;
}

/** Handles a provider `paused` read as S6's second event. */
export async function handleProviderPauseIsArrears(
    input: ProviderPauseArrearsInput,
    ports: GraceExpiryCheckPorts
): Promise<void> {
    const value = inputSchema.parse(input);
    const [row] = await getDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(subscriptions)
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, value.subscriptionId))
        .limit(1);
    if (!row || !['ACTIVE', 'GRACE_PERIOD'].includes(row.subscription.status)) {
        logger.info(
            { subscriptionId: value.subscriptionId },
            'Provider pause row no longer applies'
        );
        return;
    }
    const subscription = row.subscription;
    if (subscription.class !== 'PRINCIPAL' || subscription.paymentMethod !== 'CARD') {
        await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: subscription.id },
            reason: 'TRANSICION_NO_DECLARADA',
            actor: { type: 'provider' },
            correlationId: randomUUID()
        });
        logger.warn(
            { subscriptionId: subscription.id },
            'Provider pause is not declared for this subscription'
        );
        return;
    }
    if (!row.providerLink)
        throw new Error(`Provider pause subscription ${subscription.id} has no provider link`);
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readAuthorization({
        authorizationId: row.providerLink.providerId
    });
    const { snapshot } = assertFreshForAct({ read, act });
    if (snapshot.status !== 'paused') {
        logger.info(
            { subscriptionId: subscription.id, providerStatus: snapshot.status },
            'Provider pause changed before receiver decision'
        );
        return;
    }
    const decision = arrearsPauseDecision({ subscription, at: act.startedAt });
    if (!decision) return;
    await runArrearsDecisionAfterPeriodRead({ subscription, read, act, ...decision }, ports);
}

/** Routes a `cancelled` notice through expired-grace S6 when its guards allow it. */
export async function handleCancelledOnExpiredGrace(
    input: ProviderPauseArrearsInput,
    ports: GraceExpiryCheckPorts
): Promise<boolean> {
    const value = inputSchema.parse(input);
    const [row] = await getDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(subscriptions)
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, value.subscriptionId))
        .limit(1);
    if (!row) return false;
    const { subscription } = row;
    if (
        subscription.status !== 'GRACE_PERIOD' ||
        subscription.class !== 'PRINCIPAL' ||
        subscription.paymentMethod !== 'CARD' ||
        subscription.graceEndsAt === null ||
        subscription.graceEndsAt > value.readAt
    )
        return false;
    if (await isLiveSuccessionPredecessor({ subscriptionId: subscription.id })) return false;
    if (
        await (ports.retainedPeriodPayment ?? openSuccessionRetentions).hasRetainedPeriodPayment({
            subscriptionId: subscription.id
        })
    )
        return false;
    if (!row.providerLink)
        throw new Error(`Expired grace subscription ${subscription.id} has no provider link`);

    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readAuthorization({
        authorizationId: row.providerLink.providerId
    });
    assertFreshForAct({ read, act });
    await runArrearsDecisionAfterPeriodRead(
        {
            subscription,
            read,
            act,
            event: 'GRACE_EXPIRED',
            occurrenceId: graceExpiredOccurrenceId({
                subscriptionId: subscription.id,
                graceEndsAt: subscription.graceEndsAt
            })
        },
        ports
    );
    return true;
}
