import { and, type DrizzleClient, eq, subscriptions } from '@repo/db';
import { z } from 'zod';

const releaseSchema = z.strictObject({
    predecessorId: z.uuid(),
    successorId: z.uuid(),
    now: z.date()
});

/**
 * S40 on a successor (HOS-2344): the person cancelled their pending plan change, so the
 * predecessor's `succeeded_by_id` goes back to NULL inside the caller's transaction. The
 * abandoned successor keeps its `succeeds_id` as the faithful record. Only a pointer that
 * still names this successor is released.
 *
 * @param input.predecessorId - The successor's `succeeds_id`
 * @param input.successorId - The successor S40 just abandoned
 * @param input.now - The instant of the transition
 * @param input.tx - The S40 transaction
 * @returns Whether the predecessor pointer was released
 */
export async function releaseCancelledSuccessionPredecessor(input: {
    readonly predecessorId: string;
    readonly successorId: string;
    readonly now: Date;
    readonly tx: DrizzleClient;
}): Promise<{ readonly released: boolean }> {
    const value = releaseSchema.parse({
        predecessorId: input.predecessorId,
        successorId: input.successorId,
        now: input.now
    });
    const rows = await input.tx
        .update(subscriptions)
        .set({ succeededById: null, updatedAt: value.now })
        .where(
            and(
                eq(subscriptions.id, value.predecessorId),
                eq(subscriptions.succeededById, value.successorId)
            )
        )
        .returning({ id: subscriptions.id });
    return { released: rows.length > 0 };
}
