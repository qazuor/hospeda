import type { Clock } from '@repo/billing-verticals-contract';
import { and, desc, eq, getDb, idempotencyKeys, providerLinks, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { replacePendingAttempt } from './replace-pending-attempt.service.js';
import { isNotAppliedCreationResult } from './resolve-live-commitment.js';
import type { BeforeCancelNotice } from './start-subscription.service.js';

const logger = createLogger('succession-replace-unapplied');

/** Replaces an eligible unapplied successor; false leaves the ordinary 409 path intact. */
export async function replaceUnappliedSuccessor(
    input: {
        readonly predecessorId: string;
        readonly billingOptionId: string;
        readonly userId: string;
    },
    ports: {
        readonly provider: Parameters<typeof replacePendingAttempt>[1]['provider'];
        readonly clock: Clock;
        readonly beforeCancelNotice: BeforeCancelNotice;
    }
): Promise<boolean> {
    const [row] = await getDb()
        .select({
            subscription: subscriptions,
            idempotencyKey: idempotencyKeys,
            providerLink: providerLinks
        })
        .from(subscriptions)
        .leftJoin(
            idempotencyKeys,
            and(
                eq(idempotencyKeys.subjectId, subscriptions.id),
                eq(idempotencyKeys.operation, 'PREAPPROVAL_CREATE')
            )
        )
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(
            and(
                eq(subscriptions.succeedsId, input.predecessorId),
                eq(subscriptions.status, 'PENDING_AUTHORIZATION')
            )
        )
        .orderBy(desc(idempotencyKeys.createdAt), desc(idempotencyKeys.key))
        .limit(1);
    if (!row) return false;
    const { subscription, idempotencyKey, providerLink } = row;
    if (subscription.class !== 'PRINCIPAL' || subscription.paymentMethod !== 'CARD') return false;
    if (subscription.billingOptionId !== input.billingOptionId) return false;
    if (
        !idempotencyKey ||
        idempotencyKey.completedAt === null ||
        !isNotAppliedCreationResult(idempotencyKey.result)
    )
        return false;
    const authorizationId = isNotAppliedCreationResult(idempotencyKey.result)
        ? (idempotencyKey.result as { authorizationId: string }).authorizationId
        : undefined;
    if (!providerLink || providerLink.providerId !== authorizationId) {
        logger.error(
            { subscriptionId: subscription.id },
            'Unapplied successor has an inconsistent provider link'
        );
        return false;
    }
    const windowEndsAt = subscription.authorizationWindowEndsAt;
    if (!windowEndsAt || ports.clock.now().getTime() >= windowEndsAt.getTime()) return false;

    try {
        await replacePendingAttempt(
            {
                commitment: { subscription, idempotencyKey, providerLink },
                userId: input.userId,
                predecessorId: input.predecessorId
            },
            ports
        );
    } catch (error) {
        if (
            error instanceof ServiceError &&
            (error.reason === 'COMMITMENT_TAKEN' || error.reason === 'PREVIOUS_ATTEMPT_IN_PROGRESS')
        )
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'A succession is already in progress',
                undefined,
                'SUCCESSION_IN_PROGRESS'
            );
        throw error;
    }
    return true;
}
