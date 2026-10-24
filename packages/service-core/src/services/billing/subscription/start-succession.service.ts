import { randomUUID } from 'node:crypto';
import {
    and,
    eq,
    getDb,
    idempotencyKeys,
    type PendingAuthorizationRow,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils';
import { getCurrentBillingDeadlines } from '../deadlines/billing-deadlines.service';
import type { MirrorDelegates } from '../notice/provider-notice-ports.js';
import { admitSuccessionPredecessor } from './admit-succession-predecessor.js';
import {
    assertCardCheckoutVertical,
    assertPlanForSale,
    assertTouristVipPurchaseAllowed,
    authorizePendingSubscription,
    readBillingChoice,
    type StartSubscriptionInput,
    type StartSubscriptionPorts,
    type StartSubscriptionResult
} from './start-subscription.service.js';

const logger = createLogger('subscription-succession');

/** Ports shared with S1 plus the optional provider notice transition delegate. */
export type StartSuccessionPorts = StartSubscriptionPorts & { readonly mirror?: MirrorDelegates };

/** S1 succession input. */
export interface StartSuccessionInput extends StartSubscriptionInput {
    readonly predecessorSubscriptionId: string;
}

/** Result of creating a pending successor. */
export interface StartSuccessionResult extends StartSubscriptionResult {
    readonly predecessorId: string;
    readonly basis: string;
}

/** Pure default schedule for the first successor charge. */
export function scheduleSuccessorFirstCharge(input: { readonly authorizationWindowEndsAt: Date }): {
    readonly firstChargeAt: Date;
} {
    return {
        firstChargeAt: new Date(input.authorizationWindowEndsAt.getTime() + 24 * 60 * 60 * 1000)
    };
}

/**
 * Creates a pending S1 successor after re-reading and admitting its predecessor.
 * @throws {ServiceError} When the plan or predecessor cannot be used for succession.
 */
export async function startSuccession(
    input: StartSuccessionInput,
    ports: StartSuccessionPorts
): Promise<StartSuccessionResult> {
    const choice = await readBillingChoice({ billingOptionId: input.billingOptionId });
    assertCardCheckoutVertical({ vertical: choice.vertical });
    await assertPlanForSale({ planVersionId: choice.planVersionId, planPolicy: ports.planPolicy });
    await assertTouristVipPurchaseAllowed({
        vertical: choice.vertical,
        userId: input.userId,
        touristVipInheritance: ports.touristVipInheritance
    });

    const admitted = await admitSuccessionPredecessor(
        { predecessorSubscriptionId: input.predecessorSubscriptionId, userId: input.userId },
        { provider: ports.provider, clock: ports.clock, mirror: ports.mirror }
    );
    if (admitted.predecessor.vertical !== choice.vertical) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Succession must stay within the same vertical',
            undefined,
            'SUCCESSION_VERTICAL_MISMATCH'
        );
    }

    const deadlines = await getCurrentBillingDeadlines();
    const authorizationWindowEndsAt = new Date(
        ports.clock.now().getTime() + deadlines.values['10'].cardHours * 60 * 60 * 1000
    );
    const bornAt = ports.clock.now();
    let providerFirstChargeAt: string | undefined;
    let values: typeof subscriptions.$inferInsert;
    if (admitted.basis === 'CARD_SUSPENDED_CONFIRMED_CANCELLED') {
        values = {
            userId: input.userId,
            vertical: choice.vertical,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.id,
            paymentMethod: 'CARD',
            status: 'PENDING_AUTHORIZATION',
            class: 'PRINCIPAL',
            authorizationWindowDeadlineVersion: deadlines.version,
            authorizationWindowEndsAt,
            succeedsId: admitted.predecessorId,
            firstChargeAt: bornAt
        };
    } else {
        const schedule = scheduleSuccessorFirstCharge({ authorizationWindowEndsAt });
        if (!(schedule.firstChargeAt > authorizationWindowEndsAt)) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Successor first charge must follow its authorization window'
            );
        }
        providerFirstChargeAt = schedule.firstChargeAt.toISOString();
        values = {
            userId: input.userId,
            vertical: choice.vertical,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.id,
            paymentMethod: 'CARD',
            status: 'PENDING_AUTHORIZATION',
            class: 'PRINCIPAL',
            authorizationWindowDeadlineVersion: deadlines.version,
            authorizationWindowEndsAt,
            succeedsId: admitted.predecessorId,
            firstChargeAt: schedule.firstChargeAt
        };
    }

    let pending: PendingAuthorizationRow;
    try {
        pending = await getDb().transaction(async (tx) => {
            const [subscription] = await tx.insert(subscriptions).values(values).returning();
            if (!subscription)
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Successor insert returned no row'
                );
            const key = randomUUID();
            await tx.insert(idempotencyKeys).values({
                key,
                operation: 'PREAPPROVAL_CREATE',
                subjectId: subscription.id
            });
            const moved = await tx
                .update(subscriptions)
                .set({ succeededById: subscription.id, updatedAt: ports.clock.now() })
                .where(
                    and(
                        eq(subscriptions.id, admitted.predecessorId),
                        eq(subscriptions.status, admitted.predecessor.status)
                    )
                )
                .returning({ id: subscriptions.id });
            if (moved.length !== 1) {
                throw new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'Succession predecessor moved during creation',
                    undefined,
                    'SUCCESSION_PREDECESSOR_MOVED'
                );
            }
            return { subscription, idempotencyKey: key };
        });
    } catch (error) {
        if (error instanceof ServiceError) throw error;
        const cause = extractPostgresErrorCause(error);
        if (
            cause?.code === '23505' &&
            cause.constraint === 'uq_subscription_commitment_successor'
        ) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'A succession is already in progress',
                undefined,
                'SUCCESSION_IN_PROGRESS'
            );
        }
        logger.error(
            { predecessorId: admitted.predecessorId, error },
            'Successor transaction failed'
        );
        throw error;
    }

    const result = await authorizePendingSubscription({
        pending,
        provider: ports.provider,
        clock: ports.clock,
        reason: choice.planName,
        returnUrl: input.returnUrl,
        payerEmail: input.payerEmail,
        paymentToken: input.paymentToken,
        ...(providerFirstChargeAt ? { firstChargeAt: providerFirstChargeAt } : {})
    });
    return {
        ...result,
        predecessorId: admitted.predecessorId,
        basis: admitted.basis
    };
}
