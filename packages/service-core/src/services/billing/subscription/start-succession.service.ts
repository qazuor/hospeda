import { randomUUID } from 'node:crypto';
import {
    and,
    type DrizzleClient,
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
import { exitPlanMigration } from '../plan-migration/plan-migration-exit.js';
import { admitSuccessionPredecessor } from './admit-succession-predecessor.js';
import { readCycleDeadlines } from './plan-change-cycle-deadlines.js';
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
import { SUCCESSION_CHECKOUT_OPEN_STATUS } from './succession-in-progress.js';
import { resolveSuccessorWindow } from './successor-window.js';
import {
    readHasCreditedCharge,
    readLockedSuccessorWindowPredecessor
} from './successor-window-credit.js';

const logger = createLogger('subscription-succession');

/** Ports shared with S1 plus optional notice and AC:B8b:7, Q2 first-charge scheduling. */
export type StartSuccessionPorts = StartSubscriptionPorts & {
    readonly mirror?: MirrorDelegates;
    /** AC:B8b:7, Q2: value-credit schedule for a non-exceptional successor. */
    readonly firstChargeSchedule?: (input: {
        readonly authorizationWindowEndsAt: Date;
        readonly bornAt: Date;
        readonly predecessorId: string;
    }) => Promise<{ readonly firstChargeAt: Date }>;
};

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
 * HOS-2223: re-decides the successor window under the predecessor's row lock, inside the
 * transaction that persists the successor. The first decision ran in an earlier transaction;
 * if P1 credited the predecessor's first charge in between, the window chosen then (full,
 * because no charge was credited) may no longer hold. P1 takes the same row lock before
 * opening the covered period, so from here until commit no charge can be credited.
 *
 * @throws {ServiceError} `SUCCESSION_WINDOW_TOO_SHORT` when the fresh decision rejects, or
 *   `SUCCESSION_PREDECESSOR_MOVED` when it offers a different window than the one stored
 */
async function revalidateSuccessorWindow(input: {
    readonly tx: DrizzleClient;
    readonly predecessorId: string;
    readonly windowLimits: {
        readonly now: Date;
        readonly cardHours: number;
        readonly minimumRemainingHours: number;
    };
    readonly authorizationWindowEndsAt: Date;
}): Promise<void> {
    const predecessor = await readLockedSuccessorWindowPredecessor({
        tx: input.tx,
        subscriptionId: input.predecessorId
    });
    if (!predecessor)
        throw new ServiceError(
            ServiceErrorCode.ALREADY_EXISTS,
            'Succession predecessor moved during creation',
            undefined,
            'SUCCESSION_PREDECESSOR_MOVED'
        );
    const fresh = resolveSuccessorWindow({ ...input.windowLimits, predecessor });
    if (fresh.kind === 'NOT_OFFERED')
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Successor authorization window is too short',
            undefined,
            'SUCCESSION_WINDOW_TOO_SHORT'
        );
    if (fresh.endsAt.getTime() !== input.authorizationWindowEndsAt.getTime())
        throw new ServiceError(
            ServiceErrorCode.ALREADY_EXISTS,
            'Succession predecessor moved during creation',
            undefined,
            'SUCCESSION_PREDECESSOR_MOVED'
        );
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
    const { cycleDeadlines, credit } = await getDb().transaction(async (tx) => ({
        cycleDeadlines: await readCycleDeadlines({ tx, subscriptionId: admitted.predecessorId }),
        credit: await readHasCreditedCharge({ tx, subscriptionId: admitted.predecessorId })
    }));
    const windowNow = ports.clock.now();
    const windowLimits = {
        now: windowNow,
        cardHours: deadlines.values['10'].cardHours,
        minimumRemainingHours: cycleDeadlines.values['15'].hoursRemaining
    } as const;
    const window = resolveSuccessorWindow({
        ...windowLimits,
        predecessor: {
            status: admitted.predecessor.status,
            paymentMethod: admitted.predecessor.paymentMethod,
            nextChargeAt: admitted.predecessor.nextChargeAt,
            hasCreditedCharge: credit.hasCreditedCharge
        }
    });
    if (window.kind === 'NOT_OFFERED')
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Successor authorization window is too short',
            undefined,
            'SUCCESSION_WINDOW_TOO_SHORT'
        );
    const authorizationWindowEndsAt = window.endsAt;
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
            status: SUCCESSION_CHECKOUT_OPEN_STATUS,
            class: 'PRINCIPAL',
            authorizationWindowDeadlineVersion: deadlines.version,
            authorizationWindowEndsAt,
            succeedsId: admitted.predecessorId,
            firstChargeAt: bornAt
        };
    } else {
        const schedule = ports.firstChargeSchedule
            ? await ports.firstChargeSchedule({
                  authorizationWindowEndsAt,
                  bornAt,
                  predecessorId: admitted.predecessorId
              })
            : scheduleSuccessorFirstCharge({ authorizationWindowEndsAt });
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
            status: SUCCESSION_CHECKOUT_OPEN_STATUS,
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
            await revalidateSuccessorWindow({
                tx,
                predecessorId: admitted.predecessorId,
                windowLimits,
                authorizationWindowEndsAt
            });
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
            await exitPlanMigration({
                tx,
                subscriptionId: admitted.predecessorId,
                reason: 'CAMBIO_DE_PLAN'
            });
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
        reason: choice.providerReason,
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
