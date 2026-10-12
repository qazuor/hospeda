import type { Clock, VerticalsForBilling } from '@repo/billing-verticals-contract';
import { and, eq, getDb, gte, inArray, payments, providerLinks, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { enqueueGraceStartedNotice } from './grace-started-notice';
import { noCreditedPayments, type SubscriptionPayments } from './subscription-billing-ports';

const logger = createLogger('enter-grace');
const inputSchema = z.strictObject({ chargeId: z.string().min(1) });
const CREDITED_PAYMENT_STATUSES = [
    'SUCCEEDED',
    'PARTIALLY_REFUNDED',
    'REFUNDED',
    'CHARGED_BACK'
] as const;
const DAY_MS = 86_400_000;

/** Outcomes of applying S4 to a freshly reread rejected charge. */
export type EnterGraceResult =
    | {
          readonly outcome: 'GRACE_STARTED';
          readonly subscriptionId: string;
          readonly graceStartedAt: Date;
          readonly graceEndsAt: Date;
      }
    | { readonly outcome: 'ALREADY_IN_GRACE'; readonly subscriptionId: string }
    | {
          readonly outcome: 'NOT_APPLICABLE';
          readonly reason:
              | 'CHARGE_NOT_REJECTED'
              | 'NO_SUBSCRIPTION'
              | 'NOT_ACTIVE'
              | 'NOT_CARD_PRINCIPAL'
              | 'NO_CREDITED_PAYMENT'
              | 'NOT_CURRENT_PERIOD'
              | 'LOST_RACE';
      };

/** Ports needed by S4; `planPolicy` is registered by the API composition root. */
export interface EnterGracePorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly payments?: SubscriptionPayments;
    readonly planPolicy?: VerticalsForBilling['planPolicy'];
}

/** Re-reads the rejected charge by id and opens grace for a paid card principal. */
export async function enterGraceOnRejectedCharge(
    input: { readonly chargeId: string },
    ports: EnterGracePorts
): Promise<EnterGraceResult> {
    const value = inputSchema.parse(input);
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readCharge({ chargeId: value.chargeId });
    const { snapshot: charge, readAt } = assertFreshForAct({ read, act });
    if (charge.status !== 'rejected')
        return { outcome: 'NOT_APPLICABLE', reason: 'CHARGE_NOT_REJECTED' };
    // A card-validation charge (RP12) belongs to no authorization, so no subscription enters grace.
    if (charge.authorizationId === null)
        return { outcome: 'NOT_APPLICABLE', reason: 'NO_SUBSCRIPTION' };

    const [row] = await getDb()
        .select({ subscription: subscriptions })
        .from(providerLinks)
        .innerJoin(subscriptions, eq(subscriptions.id, providerLinks.subscriptionId))
        .where(eq(providerLinks.providerId, charge.authorizationId))
        .limit(1);
    if (!row) return { outcome: 'NOT_APPLICABLE', reason: 'NO_SUBSCRIPTION' };
    const { subscription } = row;
    if (subscription.status === 'GRACE_PERIOD')
        return { outcome: 'ALREADY_IN_GRACE', subscriptionId: subscription.id };
    if (subscription.status !== 'ACTIVE')
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_ACTIVE' };
    if (subscription.class !== 'PRINCIPAL' || subscription.paymentMethod !== 'CARD')
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_CARD_PRINCIPAL' };

    const paymentsPort = ports.payments ?? noCreditedPayments;
    if (!(await paymentsPort.hasCreditedPayment({ subscriptionId: subscription.id })))
        return { outcome: 'NOT_APPLICABLE', reason: 'NO_CREDITED_PAYMENT' };

    const [paidCurrentPeriod] = await getDb()
        .select({ id: payments.id })
        .from(payments)
        .where(
            and(
                eq(payments.subscriptionId, subscription.id),
                inArray(payments.status, [...CREDITED_PAYMENT_STATUSES]),
                gte(payments.factAt, new Date(charge.createdAt))
            )
        )
        .limit(1);
    if (paidCurrentPeriod) return { outcome: 'NOT_APPLICABLE', reason: 'NOT_CURRENT_PERIOD' };

    if (!ports.planPolicy)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Plan policy is not registered for grace entry',
            undefined,
            'PLAN_POLICY_NOT_REGISTERED'
        );
    if (!subscription.planVersionId)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Principal subscription has no plan version for grace policy',
            undefined,
            'SUBSCRIPTION_PLAN_VERSION_MISSING'
        );
    const { graceDays } = await ports.planPolicy({ planVersionId: subscription.planVersionId });
    const graceStartedAt = readAt;
    const graceEndsAt = new Date(graceStartedAt.getTime() + graceDays * DAY_MS);

    const started = await getDb().transaction(async (tx) => {
        const [updated] = await tx
            .update(subscriptions)
            .set({
                status: 'GRACE_PERIOD',
                graceStartedAt,
                graceEndsAt,
                updatedAt: ports.clock.now()
            })
            .where(and(eq(subscriptions.id, subscription.id), eq(subscriptions.status, 'ACTIVE')))
            .returning();
        if (!updated) return false;
        await enqueueGraceStartedNotice({
            tx,
            subscription: updated,
            chargeId: value.chargeId,
            graceEndsAt
        });
        return true;
    });
    if (!started) return { outcome: 'NOT_APPLICABLE', reason: 'LOST_RACE' };

    logger.info(
        { subscriptionId: subscription.id },
        'Subscription entered grace after rejected charge'
    );
    return {
        outcome: 'GRACE_STARTED',
        subscriptionId: subscription.id,
        graceStartedAt,
        graceEndsAt
    };
}
