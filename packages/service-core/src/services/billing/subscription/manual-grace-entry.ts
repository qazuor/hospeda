import { and, type DrizzleClient, eq, subscriptions } from '@repo/db';

const DAY_MS = 86_400_000;

/** Applies manual S4 while the caller holds the subscription lock. */
export async function enterManualGraceInTx(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly now: Date;
    readonly graceDays: number;
}): Promise<boolean> {
    const [row] = await input.tx
        .update(subscriptions)
        .set({
            status: 'GRACE_PERIOD',
            graceStartedAt: input.now,
            graceEndsAt: new Date(input.now.getTime() + input.graceDays * DAY_MS),
            updatedAt: input.now
        })
        .where(and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.status, 'ACTIVE')))
        .returning({ id: subscriptions.id });
    return Boolean(row);
}
