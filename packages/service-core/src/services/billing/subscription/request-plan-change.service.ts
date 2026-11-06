import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import { eq, getDb, listingPublicationModel, subscriptions } from '@repo/db';
import {
    BillingCycleSchema,
    PublicationStatusEnum,
    ServiceErrorCode,
    VerticalEnumSchema
} from '@repo/schemas';
import { PUBLICATION_LIMIT_KEYS, type PublicationVertical } from '@repo/verticals';
import { z } from 'zod';
import { ServiceError } from '../../../types/index.js';
import { extractPostgresErrorCause } from '../../../utils/index.js';
import {
    type DowngradeSurplusPreview,
    previewDowngradeSurplus
} from './downgrade-surplus-preview.js';
import { readCycleDeadlines } from './plan-change-cycle-deadlines.js';
import {
    mutatePlanChangeAmount,
    queueDowngrade,
    readPlanChangeOrigin,
    readPlanChangeOriginCycle,
    readPlanChangeTarget,
    readScheduledPlanChange,
    readSuccessorCredit,
    removeQueuedDowngrade,
    replaceQueuedDowngrade
} from './request-plan-change-support.js';
import { type StartSuccessionPorts, startSuccession } from './start-succession.service.js';
import { scheduleSuccessorFirstChargeWithCredit } from './successor-credit.js';
import { resolveSuccessorWindow } from './successor-window.js';

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
          readonly surplus: DowngradeSurplusPreview;
      }
    | { readonly path: 'REGRET'; readonly amountMinor: number }
    /** AC:B8b:18, PLAZO:15: the predecessor's cycle leaves too little checkout time. */
    | {
          readonly path: 'REJECTED';
          readonly reason: 'CHANGE_WINDOW_TOO_SHORT';
          readonly availableFrom: Date;
      }
    | {
          readonly path: 'REJECTED';
          readonly reason:
              | 'NO_CHANGE'
              | 'GRACE_PERIOD'
              | 'SCHEDULED_CHANGE_EXISTS'
              | 'NOT_ACTIVE'
              | 'MIGRATION_CHANGE_QUEUED'
              | 'KEEP_SELECTION_INVALID';
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
    if (origin.subscription.status === 'GRACE_PERIOD')
        return { path: 'REJECTED', reason: 'GRACE_PERIOD' };
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

    /** DEC-SUB-006 and EX-4 forbid mutating a live cycle; EX-20 makes a cross-cycle DOWN a succession. */
    const crossesCycle =
        direction === 'DOWN' &&
        (await readPlanChangeOriginCycle({
            billingOptionId: origin.subscription.billingOptionId
        })) !== BillingCycleSchema.parse(target.cycle);

    if (direction === 'DOWN' && !crossesCycle) {
        if (origin.subscription.status !== 'ACTIVE')
            return { path: 'REJECTED', reason: 'NOT_ACTIVE' };
        const existingQueue = queued;
        if (existingQueue?.planMigrationSubscriptionId)
            return { path: 'REJECTED', reason: 'MIGRATION_CHANGE_QUEUED' };
        const targetVertical = VerticalEnumSchema.parse(target.vertical);
        const surplus = await previewDowngradeSurplus({
            userId: value.actor.id,
            vertical: targetVertical,
            targetPlanVersionId: target.planVersionId
        });
        const selection = value.keepSelection ?? {};
        const selectionKeys = Object.keys(selection);
        const expectedKey = isPublicationVertical(targetVertical)
            ? PUBLICATION_LIMIT_KEYS[targetVertical]
            : null;
        if (
            (selectionKeys.length > 0 &&
                (selectionKeys.length !== 1 || selectionKeys[0] !== expectedKey)) ||
            (selectionKeys.length > 0 && expectedKey === null)
        )
            return { path: 'REJECTED', reason: 'KEEP_SELECTION_INVALID' };
        const selectedIds = expectedKey ? (selection[expectedKey] ?? []) : [];
        if (selectedIds.length > 0) {
            if (!isPublicationVertical(targetVertical))
                return { path: 'REJECTED', reason: 'KEEP_SELECTION_INVALID' };
            const listings = await listingPublicationModel.listByOwner({
                tx: getDb(),
                vertical: targetVertical,
                ownerId: value.actor.id
            });
            const publishedIds = new Set(
                listings
                    .filter((row) => row.publicationStatus === PublicationStatusEnum.PUBLISHED)
                    .map((row) => row.id)
            );
            if (selectedIds.some((id) => !publishedIds.has(id)))
                return { path: 'REJECTED', reason: 'KEEP_SELECTION_INVALID' };
        }
        const keepSelection =
            selectedIds.length > 0 && surplus.applicable && surplus.surplusCount > 0
                ? { [surplus.limitKey]: selectedIds }
                : undefined;
        const keepListingIds = new Set(selectedIds);
        const selectedSurplus =
            selectedIds.length > 0
                ? await previewDowngradeSurplus({
                      userId: value.actor.id,
                      vertical: targetVertical,
                      targetPlanVersionId: target.planVersionId,
                      keepListingIds
                  })
                : surplus;
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
                    keepSelection
                });
                return {
                    path: 'DOWNGRADE',
                    effectiveAt,
                    amountMinor: target.amount,
                    replaced: true,
                    surplus: selectedSurplus
                };
            }
            await queueDowngrade({
                subscriptionId: value.subscriptionId,
                targetPlanVersionId: target.planVersionId,
                targetBillingOptionId: target.id,
                effectiveAt,
                keepSelection
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
        return {
            path: 'DOWNGRADE',
            effectiveAt,
            amountMinor: target.amount,
            surplus: selectedSurplus
        };
    }

    const targetCycle = BillingCycleSchema.parse(target.cycle);
    const window = await getDb().transaction(async (tx) => {
        const deadlines = await readCycleDeadlines({ tx, subscriptionId: value.subscriptionId });
        return resolveSuccessorWindow({
            now: ports.clock.now(),
            cardHours: deadlines.values['10'].cardHours,
            minimumRemainingHours: deadlines.values['15'].hoursRemaining,
            predecessor: {
                status: origin.subscription.status,
                paymentMethod: origin.subscription.paymentMethod,
                nextChargeAt: origin.subscription.nextChargeAt
            }
        });
    });
    if (window.kind === 'NOT_OFFERED')
        return {
            path: 'REJECTED',
            reason: 'CHANGE_WINDOW_TOO_SHORT',
            availableFrom: window.availableFrom
        };
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

function isPublicationVertical(vertical: string): vertical is PublicationVertical {
    return vertical === 'accommodation' || vertical === 'venue' || vertical === 'experience';
}
