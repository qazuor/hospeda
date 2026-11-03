import {
    and,
    type DrizzleClient,
    eq,
    getDb,
    isNull,
    providerLinks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { z } from 'zod';

/** Validated S17 input. */
export const cancelSuccessionPredecessorInputSchema = z.strictObject({
    successorSubscriptionId: z.uuid()
});

/** The rows S17 needs before any provider call or transaction. */
export async function readSuccessionPredecessor(successorSubscriptionId: string) {
    const db = getDb();
    const [successor] = await db
        .select({
            id: subscriptions.id,
            status: subscriptions.status,
            predecessorId: subscriptions.succeedsId
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, successorSubscriptionId))
        .limit(1);
    if (!successor?.predecessorId) return { successor, predecessor: null, successorLink: null };
    const [predecessor] = await db
        .select({
            id: subscriptions.id,
            status: subscriptions.status,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical,
            paymentMethod: subscriptions.paymentMethod
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, successor.predecessorId))
        .limit(1);
    const [successorLink] = await db
        .select({ providerId: providerLinks.providerId })
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, successor.id))
        .limit(1);
    return { successor, predecessor: predecessor ?? null, successorLink: successorLink ?? null };
}

/** Reads the predecessor authorization link without holding a lock. */
export async function readPredecessorAuthorizationId(
    subscriptionId: string
): Promise<string | null> {
    const [link] = await getDb()
        .select({ providerId: providerLinks.providerId })
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, subscriptionId))
        .limit(1);
    return link?.providerId ?? null;
}

/** S17's guarded status and service-end write, registered as a turns-off writer by G5. */
export async function writeSuccessionPredecessorCancellation(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly observedStatus: string;
    readonly now: Date;
}): Promise<boolean> {
    const [written] = await input.tx
        .update(subscriptions)
        .set({ status: 'CANCELLED', serviceEndsAt: input.now, updatedAt: input.now })
        .where(
            and(
                eq(subscriptions.id, input.subscriptionId),
                eq(subscriptions.status, input.observedStatus)
            )
        )
        .returning({ id: subscriptions.id });
    return written !== undefined;
}

/** Closes the open S8 pause under the predecessor row lock. */
export async function closeSuccessionPredecessorPause(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly now: Date;
}): Promise<boolean> {
    const [pause] = await input.tx
        .select({ id: subscriptionPauses.id })
        .from(subscriptionPauses)
        .where(
            and(
                eq(subscriptionPauses.subscriptionId, input.subscriptionId),
                isNull(subscriptionPauses.actualEndAt)
            )
        )
        .limit(1);
    if (!pause) throw new Error('S17 PAUSED predecessor has no open pause');
    const [closed] = await input.tx
        .update(subscriptionPauses)
        .set({ actualEndAt: input.now })
        .where(and(eq(subscriptionPauses.id, pause.id), isNull(subscriptionPauses.actualEndAt)))
        .returning({ id: subscriptionPauses.id });
    if (!closed) throw new Error('S17 open pause changed under predecessor lock');
    return true;
}
