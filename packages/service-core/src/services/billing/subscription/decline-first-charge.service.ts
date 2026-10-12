import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    eq,
    getDb,
    inArray,
    LIVE_SUBSCRIPTION_STATUSES,
    providerLinks,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { z } from 'zod';
import { enqueueSignupDeclinedNotice } from './signup-declined-notice';
import type { BeforeCancelNotice } from './start-subscription.service';
import {
    type CancellationSeenAnnotator,
    noCancellationSeenAnnotation,
    noCreditedPayments,
    recordCancellationSeen,
    type SubscriptionPayments,
    type SuccessionCloser,
    unimplementedSuccessionCloser
} from './subscription-billing-ports';

const logger = createLogger('decline-first-charge');

const DeclineFirstChargeInputSchema = z.strictObject({ chargeId: z.string().min(1) });

export type DeclineFirstChargeResult =
    | {
          readonly outcome: 'DECLINED';
          readonly subscriptionId: string;
          readonly cancelCall: 'SENT' | 'FAILED' | 'DEFERRED' | 'NOT_NEEDED';
          readonly successionClosed: boolean;
      }
    | {
          readonly outcome: 'NOT_APPLICABLE';
          readonly reason:
              | 'CHARGE_NOT_REJECTED'
              | 'NO_SUBSCRIPTION'
              | 'NOT_ACTIVE'
              | 'HAS_CREDITED_PAYMENT'
              | 'LEFT_TO_S4'
              | 'LOST_RACE';
      };

export interface DeclineFirstChargePorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly payments?: SubscriptionPayments;
    readonly successionCloser?: SuccessionCloser;
    readonly cancellationSeen?: CancellationSeenAnnotator;
}

/** S16: the first rejected charge of a signup closes its authorization and signup row. */
export async function declineFirstCharge(
    input: { readonly chargeId: string },
    ports: DeclineFirstChargePorts
): Promise<DeclineFirstChargeResult> {
    const value = DeclineFirstChargeInputSchema.parse(input);
    const payments = ports.payments ?? noCreditedPayments;
    const successionCloser = ports.successionCloser ?? unimplementedSuccessionCloser;

    const chargeAct = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act: chargeAct });
    const chargeRead = await ports.provider.readCharge({ chargeId: value.chargeId });
    const { snapshot: charge } = assertFreshForAct({ read: chargeRead, act: chargeAct });
    if (charge.status !== 'rejected')
        return { outcome: 'NOT_APPLICABLE', reason: 'CHARGE_NOT_REJECTED' };
    if (charge.authorizationId === null)
        return { outcome: 'NOT_APPLICABLE', reason: 'NO_SUBSCRIPTION' };

    const [row] = await getDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(providerLinks)
        .innerJoin(subscriptions, eq(subscriptions.id, providerLinks.subscriptionId))
        .where(eq(providerLinks.providerId, charge.authorizationId))
        .limit(1);
    if (!row) return { outcome: 'NOT_APPLICABLE', reason: 'NO_SUBSCRIPTION' };
    const { subscription, providerLink } = row;
    if (subscription.status !== 'ACTIVE' || subscription.class !== 'PRINCIPAL')
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_ACTIVE' };

    if (await payments.hasCreditedPayment({ subscriptionId: subscription.id }))
        return { outcome: 'NOT_APPLICABLE', reason: 'HAS_CREDITED_PAYMENT' };
    if (
        subscription.succeedsId &&
        (await payments.hasCreditedPayment({ subscriptionId: subscription.succeedsId }))
    )
        return { outcome: 'NOT_APPLICABLE', reason: 'LEFT_TO_S4' };

    const rereadAuthorization = async () => {
        const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
        actStartInstant({ act });
        const read = await ports.provider.readAuthorization({
            authorizationId: providerLink.providerId
        });
        const fresh = assertFreshForAct({ read, act });
        return { status: fresh.snapshot.status, readAt: fresh.readAt };
    };

    const authorization = await rereadAuthorization();
    let cancelCall: 'SENT' | 'FAILED' | 'DEFERRED' | 'NOT_NEEDED';
    if (authorization.status === 'cancelled') {
        await recordCancellationSeen({
            annotator: ports.cancellationSeen ?? noCancellationSeenAnnotation,
            subscriptionId: subscription.id,
            seenAt: authorization.readAt
        });
        cancelCall = 'NOT_NEEDED';
    } else {
        const notice = await ports.beforeCancelNotice.beforeCancel({
            subscriptionId: subscription.id,
            userId: subscription.userId ?? ''
        });
        if (notice === 'NOT_YET_SENT') {
            cancelCall = 'DEFERRED';
        } else {
            if (notice === 'NO_RECIPIENT' || notice === 'DELIVERY_EXHAUSTED') {
                logger.warn(
                    { subscriptionId: subscription.id, notice },
                    'Before-cancel notice is not deliverable'
                );
            }
            try {
                await ports.provider.cancel({ authorizationId: providerLink.providerId });
                cancelCall = 'SENT';
            } catch (error) {
                logger.error(
                    {
                        subscriptionId: subscription.id,
                        authorizationId: providerLink.providerId,
                        error
                    },
                    'Declined signup authorization could not be cancelled'
                );
                cancelCall = 'FAILED';
            }
        }
    }

    if (cancelCall === 'SENT') {
        try {
            const confirmed = await rereadAuthorization();
            if (confirmed.status === 'cancelled')
                await recordCancellationSeen({
                    annotator: ports.cancellationSeen ?? noCancellationSeenAnnotation,
                    subscriptionId: subscription.id,
                    seenAt: confirmed.readAt
                });
        } catch (error) {
            logger.error(
                {
                    subscriptionId: subscription.id,
                    authorizationId: providerLink.providerId,
                    error
                },
                'Could not confirm declined signup authorization cancellation'
            );
        }
    }

    const successionClosed = await getDb().transaction(async (tx) => {
        const [updated] = await tx
            .update(subscriptions)
            .set({ status: 'CHARGE_DECLINED', updatedAt: ports.clock.now() })
            .where(and(eq(subscriptions.id, subscription.id), eq(subscriptions.status, 'ACTIVE')))
            .returning();
        if (!updated) return null;

        await enqueueSignupDeclinedNotice({
            tx,
            subscription: updated,
            declineReason: charge.declineReason
        });
        const [successor] = await tx
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(
                and(
                    eq(subscriptions.succeedsId, subscription.id),
                    eq(subscriptions.class, 'PRINCIPAL'),
                    inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES)
                )
            )
            .limit(1);
        if (!successor) return false;
        await successionCloser.closeSuccession({ predecessorSubscriptionId: subscription.id, tx });
        return true;
    });
    if (successionClosed === null) return { outcome: 'NOT_APPLICABLE', reason: 'LOST_RACE' };
    return {
        outcome: 'DECLINED',
        subscriptionId: subscription.id,
        cancelCall,
        successionClosed
    };
}
