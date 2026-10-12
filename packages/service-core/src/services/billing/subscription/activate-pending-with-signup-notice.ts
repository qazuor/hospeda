/** Activate an authorization and enqueue its notice atomically. */
export async function activatePendingWithSignupNotice(input: {
    readonly subscriptionId: string;
    readonly now: Date;
}): Promise<boolean> {
    const { getDb, subscriptionModel } = await import('@repo/db');
    const { enqueueSignupConfirmedNotice } = await import('./signup-confirmed-notice.js');

    return getDb().transaction(async (tx) => {
        const wrote = await subscriptionModel.activatePendingAuthorization({
            subscriptionId: input.subscriptionId,
            now: input.now,
            tx
        });
        if (wrote) {
            await enqueueSignupConfirmedNotice({
                tx,
                subscriptionId: input.subscriptionId,
                activatedAt: input.now
            });
        }
        return wrote;
    });
}
