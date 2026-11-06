import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import { eq, getDb, subscriptions } from '@repo/db';
import { BillingCycleSchema, ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types/index.js';
import { extractPostgresErrorCause } from '../../../utils/index.js';
import {
    mutatePlanChangeAmount,
    queueDowngrade,
    readPlanChangeOrigin,
    readPlanChangeTarget,
    readScheduledPlanChange,
    readSuccessorCredit,
    removeQueuedDowngrade,
    replaceQueuedDowngrade
} from './request-plan-change-support.js';
import { type StartSuccessionPorts, startSuccession } from './start-succession.service.js';
import { scheduleSuccessorFirstChargeWithCredit } from './successor-credit.js';

const inputSchema = z.strictObject({
    actor: z.strictObject({ id: z.uuid() }),
    subscriptionId: z.uuid(),
    billingOptionId: z.uuid(),
    payerEmail: z.email().optional(),
    returnUrl: z.url(),
    keepSelection: z.record(z.string(), z.array(z.string())).optional()
});

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
    | {
          readonly path: 'DOWNGRADE';
          readonly effectiveAt: Date;
          readonly amountMinor: number;
          readonly replaced?: true;
      }
    | { readonly path: 'REGRET'; readonly amountMinor: number }
    | {
          readonly path: 'REJECTED';
          readonly reason:
              | 'NO_CHANGE'
              | 'SCHEDULED_CHANGE_EXISTS'
              | 'NOT_ACTIVE'
              | 'MIGRATION_CHANGE_QUEUED';
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
    const queued = await readScheduledPlanChange({ subscriptionId: value.subscriptionId });
    if (origin.subscription.billingOptionId === target.id && queued) {
        if (origin.subscription.status !== 'ACTIVE')
            return { path: 'REJECTED', reason: 'NOT_ACTIVE' };
        if (!origin.providerId)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Subscription has no provider authorization',
                undefined,
                'PLAN_CHANGE_NO_AUTHORIZATION'
            );
        await mutatePlanChangeAmount({
            authorizationId: origin.providerId,
            amount: { amountMinor: target.amount, currency: target.currency },
            clock: ports.clock,
            provider: ports.provider
        });
        await removeQueuedDowngrade({
            subscriptionId: value.subscriptionId,
            expectedQueueId: queued.id,
            sourcePlanVersionId: origin.subscription.planVersionId ?? '',
            sourceBillingOptionId: origin.subscription.billingOptionId ?? ''
        });
        return { path: 'REGRET', amountMinor: target.amount };
    }
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
        const existingQueue = queued;
        if (existingQueue?.planMigrationSubscriptionId)
            return { path: 'REJECTED', reason: 'MIGRATION_CHANGE_QUEUED' };
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
        await mutatePlanChangeAmount({
            authorizationId: origin.providerId,
            amount,
            clock: ports.clock,
            provider: ports.provider
        });
        try {
            if (existingQueue) {
                await replaceQueuedDowngrade({
                    subscriptionId: value.subscriptionId,
                    expectedQueueId: existingQueue.id,
                    sourcePlanVersionId: origin.subscription.planVersionId,
                    sourceBillingOptionId: origin.subscription.billingOptionId,
                    targetPlanVersionId: target.planVersionId,
                    targetBillingOptionId: target.id,
                    effectiveAt,
                    keepSelection: value.keepSelection
                });
                return {
                    path: 'DOWNGRADE',
                    effectiveAt,
                    amountMinor: target.amount,
                    replaced: true
                };
            }
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
                throw new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'Plan change state changed',
                    undefined,
                    'PLAN_CHANGE_STATE_CHANGED'
                );
            throw error;
        }
        return { path: 'DOWNGRADE', effectiveAt, amountMinor: target.amount };
    }

    const targetCycle = BillingCycleSchema.parse(target.cycle);
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
