import { and, billingOptions, eq, getDb, subscriptions } from '@repo/db';

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
    readonly planVersionId: string | null;
    readonly billingOptionId: string | null;
    readonly cycle: string | null;
    readonly amountMinor: number | null;
    readonly currency: string | null;
    readonly subscriptionClass: string;
    /**
     * Whether the row succeeds another subscription. Exposed as a flag so the
     * creating route never names the succession columns (AC:B3:5).
     */
    readonly isSuccession: boolean;
    readonly createdAt: Date;
} | null> {
    const [row] = await getDb()
        .select({
            subscriptionId: subscriptions.id,
            vertical: subscriptions.vertical,
            authorizationWindowEndsAt: subscriptions.authorizationWindowEndsAt,
            planVersionId: subscriptions.planVersionId,
            billingOptionId: subscriptions.billingOptionId,
            cycle: billingOptions.cycle,
            amountMinor: billingOptions.amount,
            currency: billingOptions.currency,
            subscriptionClass: subscriptions.class,
            succeedsId: subscriptions.succeedsId,
            createdAt: subscriptions.createdAt
        })
        .from(subscriptions)
        .leftJoin(billingOptions, eq(subscriptions.billingOptionId, billingOptions.id))
        .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, userId)))
        .limit(1);

    if (!row) return null;
    const { succeedsId, ...window } = row;
    return { ...window, isSuccession: succeedsId !== null };
}
