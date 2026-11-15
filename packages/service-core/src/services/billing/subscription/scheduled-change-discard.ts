import type { DrizzleClient } from '@repo/db';
import { eq, subscriptionScheduledChanges } from '@repo/db';

/** Deletes the queued entitlement change within the caller's transaction. */
export async function discardScheduledChange(input: {
    readonly subscriptionId: string;
    readonly tx: DrizzleClient;
}): Promise<{ readonly discarded: boolean }> {
    const [row] = await input.tx
        .delete(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, input.subscriptionId))
        .returning({ id: subscriptionScheduledChanges.id });
    return { discarded: row !== undefined };
}
