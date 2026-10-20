import { and, eq, getDb, subscriptions } from '@repo/db';

/**
 * Read the signup window and vertical from the persisted subscription row,
 * scoped to the account that started it.
 */
export async function readSignupWindow({
    subscriptionId,
    userId
}: {
    readonly subscriptionId: string;
    readonly userId: string;
}): Promise<{
    readonly vertical: string | null;
    readonly authorizationWindowEndsAt: Date | null;
} | null> {
    const [row] = await getDb()
        .select({
            vertical: subscriptions.vertical,
            authorizationWindowEndsAt: subscriptions.authorizationWindowEndsAt
        })
        .from(subscriptions)
        .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, userId)))
        .limit(1);

    return row ?? null;
}
