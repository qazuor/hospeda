import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    desc,
    eq,
    getDb,
    idempotencyKeys,
    providerLinks,
    subscriptionModel,
    subscriptions
} from '@repo/db';
import { isRecreatableCreationResult } from './resolve-live-commitment.js';
import { SUCCESSION_CHECKOUT_OPEN_STATUS } from './succession-in-progress.js';

/** A successor whose provider creation was refused and may be retried on the same row. */
export interface RecreatableSuccessor {
    readonly subscription: typeof subscriptions.$inferSelect;
    /** The fresh `PREAPPROVAL_CREATE` key minted for this retry. */
    readonly idempotencyKey: string;
}

/**
 * HOS-2218: the succession twin of S1's RECREATE. When the predecessor already has a
 * pending successor for the same billing option whose newest creation key was refused
 * by the provider (no provider link, window still open), mint a new key on that row,
 * record the newly declared payer email, and hand it back for a new authorization.
 * Returns `null` when there is nothing to recreate, so the caller keeps its normal path
 * (and its `SUCCESSION_IN_PROGRESS` answer for any other live successor).
 * Never touches the predecessor or its `succeeded_by_id`.
 */
export async function claimRecreatableSuccessor(input: {
    readonly predecessorId: string;
    readonly billingOptionId: string;
    readonly declaredPayerEmail: string;
    readonly clock: Clock;
}): Promise<RecreatableSuccessor | null> {
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
                eq(subscriptions.status, SUCCESSION_CHECKOUT_OPEN_STATUS)
            )
        )
        .orderBy(desc(idempotencyKeys.createdAt), desc(idempotencyKeys.key))
        .limit(1);
    if (!row?.idempotencyKey || row.providerLink) return null;
    const { subscription, idempotencyKey } = row;
    if (subscription.billingOptionId !== input.billingOptionId) return null;
    if (idempotencyKey.completedAt === null) return null;
    if (!isRecreatableCreationResult(idempotencyKey.result)) return null;
    const windowEndsAt = subscription.authorizationWindowEndsAt;
    if (!windowEndsAt || input.clock.now().getTime() >= windowEndsAt.getTime()) return null;
    const minted = await subscriptionModel.mintKeyAfterRejectedCreation({
        subscriptionId: subscription.id,
        rejectedKey: idempotencyKey.key,
        declaredPayerEmail: input.declaredPayerEmail,
        createdAt: input.clock.now()
    });
    if (!minted) return null;
    return {
        subscription: { ...subscription, declaredPayerEmail: input.declaredPayerEmail },
        idempotencyKey: minted.key
    };
}
