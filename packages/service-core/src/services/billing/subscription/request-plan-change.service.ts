import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import { eq, getDb, subscriptions } from '@repo/db';
import { actStartInstant, assertFreshForAct, confirmAuthorizationMutation } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types/index.js';
import { extractPostgresErrorCause } from '../../../utils/index.js';
import {
    hasScheduledPlanChange,
    queueDowngrade,
    readPlanChangeOrigin,
    readPlanChangeTarget,
    readSuccessorCredit
} from './request-plan-change-support.js';
import { type StartSuccessionPorts, startSuccession } from './start-succession.service.js';
import { scheduleSuccessorFirstChargeWithCredit } from './successor-credit.js';

const inputSchema = z.strictObject({
    actor: z.strictObject({ id: z.uuid() }),
    subscriptionId: z.uuid(),
    billingOptionId: z.uuid(),
    payerEmail: z.email().optional(),
    returnUrl: z.url()
});
const cycleSchema = z.enum(['monthly', 'quarterly', 'semiannual', 'annual']);

/** AC:B8b:7 request input. */
export type RequestPlanChangeInput = z.input<typeof inputSchema>;

/** AC:B8b:7 result for the selected provider or local queue path. */
export type RequestPlanChangeResult =
    | {
          readonly path: 'SUCCESSION';
          readonly subscriptionId: string;
          readonly checkoutUrl: string;
          readonly firstChargeAt: Date;
          readonly creditDays: number;
      }
    | { readonly path: 'DOWNGRADE'; readonly effectiveAt: Date; readonly amountMinor: number }
    | {
          readonly path: 'REJECTED';
          readonly reason: 'NO_CHANGE' | 'SCHEDULED_CHANGE_EXISTS' | 'NOT_ACTIVE';
      };

/** Ports for AC:B8b:7 and the contract's DEC-ARCH-008 direction verdict. */
export type RequestPlanChangePorts = StartSuccessionPorts & {
    readonly changeDirection: VerticalsForBilling['changeDirection'];
};

/**
 * Requests AC:B8b:7 under DEP:5, DEC-ARCH-008, DEC-SUB-006, DEC-SUB-007,
 * DEC-SUB-008 and B/12 §2.3. The surplus notice belongs to the queue,
 * HOS-1577, AC:B8b:15-16.
 */
export async function requestPlanChange(
    input: RequestPlanChangeInput,
    ports: RequestPlanChangePorts
): Promise<RequestPlanChangeResult> {
    const value = inputSchema.parse(input);
    const origin = await readPlanChangeOrigin({
        subscriptionId: value.subscriptionId,
        userId: value.actor.id
    });
    const target = await readPlanChangeTarget({ billingOptionId: value.billingOptionId });
    if (origin.subscription.billingOptionId === target.id)
        return { path: 'REJECTED', reason: 'NO_CHANGE' };
    if (!origin.subscription.planVersionId || !origin.subscription.billingOptionId)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Subscription lacks billing anchor',
            undefined,
            'PLAN_CHANGE_NO_ANCHOR'
        );
    const direction =
        origin.subscription.planVersionId === target.planVersionId
            ? 'CYCLE'
            : (
                  await ports.changeDirection({
                      fromPlanVersionId: origin.subscription.planVersionId,
                      toPlanVersionId: target.planVersionId
                  })
              ).direction;

    if (direction === 'DOWN') {
        if (origin.subscription.status !== 'ACTIVE')
            return { path: 'REJECTED', reason: 'NOT_ACTIVE' };
        if (await hasScheduledPlanChange({ subscriptionId: value.subscriptionId }))
            return { path: 'REJECTED', reason: 'SCHEDULED_CHANGE_EXISTS' };
        const effectiveAt = origin.subscription.nextChargeAt;
        if (!effectiveAt)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Subscription has no cycle end',
                undefined,
                'PLAN_CHANGE_NO_CYCLE_END'
            );
        if (!origin.providerId)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Subscription has no provider authorization',
                undefined,
                'PLAN_CHANGE_NO_AUTHORIZATION'
            );
        const amount = { amountMinor: target.amount, currency: target.currency };
        const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
        actStartInstant({ act });
        const acknowledgement = await ports.provider.changeAmount({
            authorizationId: origin.providerId,
            amount
        });
        const confirmation = await confirmAuthorizationMutation({
            provider: ports.provider,
            acknowledgement,
            sent: { amount }
        });
        assertFreshForAct({ read: confirmation.read, act }).snapshot;
        if (confirmation.outcome !== 'applied')
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Provider did not apply plan amount',
                undefined,
                'PLAN_CHANGE_MUTATION_NOT_APPLIED'
            );
        try {
            await queueDowngrade({
                subscriptionId: value.subscriptionId,
                targetPlanVersionId: target.planVersionId,
                targetBillingOptionId: target.id,
                effectiveAt
            });
        } catch (error) {
            const cause = extractPostgresErrorCause(error);
            if (
                cause?.code === '23505' &&
                cause.constraint === 'uq_subscription_scheduled_change_subscription'
            )
                return { path: 'REJECTED', reason: 'SCHEDULED_CHANGE_EXISTS' };
            throw error;
        }
        return { path: 'DOWNGRADE', effectiveAt, amountMinor: target.amount };
    }

    const targetCycle = cycleSchema.parse(target.cycle);
    let creditDays = 0;
    const successor = await startSuccession(
        {
            userId: value.actor.id,
            predecessorSubscriptionId: value.subscriptionId,
            billingOptionId: target.id,
            payerEmail: value.payerEmail,
            returnUrl: value.returnUrl
        },
        {
            ...ports,
            firstChargeSchedule: async ({ authorizationWindowEndsAt, bornAt, predecessorId }) => {
                const credit = await readSuccessorCredit({
                    subscriptionId: predecessorId,
                    now: bornAt,
                    targetAmountMinor: target.amount,
                    targetCycle
                });
                creditDays = credit.creditDays;
                return scheduleSuccessorFirstChargeWithCredit({
                    authorizationWindowEndsAt,
                    bornAt,
                    creditDays
                });
            }
        }
    );
    const [row] = await getDb()
        .select({ firstChargeAt: subscriptions.firstChargeAt })
        .from(subscriptions)
        .where(eq(subscriptions.id, successor.subscriptionId))
        .limit(1);
    if (!row?.firstChargeAt)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Successor has no first charge',
            undefined,
            'PLAN_CHANGE_NO_FIRST_CHARGE'
        );
    return {
        path: 'SUCCESSION',
        subscriptionId: successor.subscriptionId,
        checkoutUrl: successor.checkoutUrl,
        firstChargeAt: row.firstChargeAt,
        creditDays
    };
}
