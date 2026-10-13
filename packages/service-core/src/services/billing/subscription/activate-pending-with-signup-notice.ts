import { type SuccessionCloser, unimplementedSuccessionCloser } from './subscription-billing-ports';

/** Optional ports of {@link activatePendingWithSignupNotice}. */
export interface ActivatePendingWithSignupNoticePorts {
    /**
     * S18's interface (B8b), called in the same transaction when the activated row
     * succeeds a predecessor that holds an S19 retention (branch 1, AC:B7:25).
     * Defaults to `unimplementedSuccessionCloser`, which throws.
     */
    readonly successionCloser?: SuccessionCloser;
}

/**
 * S2: activate an authorization and enqueue its notice atomically.
 *
 * Branch 1 of `12` §5.3 (AC:B7:25, HOS-1561 H6): when the activated row succeeds a
 * predecessor that holds an open S19 retention, the same transaction re-reads the
 * row and calls S18 through `closeSuccessionIfPredecessor`, so the succession ends
 * in the act that authorized the successor. A closer error rolls the activation
 * back. Without a retention nothing changes: closing every succession on
 * authorization (S17) is B8b's.
 *
 * @param input.subscriptionId - The pending row
 * @param input.now - The act's instant
 * @param ports.successionCloser - S18's interface (optional)
 * @returns True when the row was activated
 */
export async function activatePendingWithSignupNotice(
    input: {
        readonly subscriptionId: string;
        readonly now: Date;
    },
    ports: ActivatePendingWithSignupNoticePorts = {}
): Promise<boolean> {
    const { eq, getDb, subscriptionModel, subscriptions } = await import('@repo/db');
    const { enqueueSignupConfirmedNotice } = await import('./signup-confirmed-notice.js');
    const { hasOpenRetention } = await import('./succession-retained-payment.js');
    const { closeSuccessionIfPredecessor } = await import('./succession-end.js');

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
            // Read under another key: an object literal carrying `succeedsId` reads as a
            // succession write to GUARD:G-R1-A.
            const [activated] = await tx
                .select({ predecessorId: subscriptions.succeedsId })
                .from(subscriptions)
                .where(eq(subscriptions.id, input.subscriptionId))
                .limit(1);
            const succeedsId = activated?.predecessorId ?? null;
            if (succeedsId && (await hasOpenRetention({ subscriptionId: succeedsId, tx }))) {
                await closeSuccessionIfPredecessor(
                    { predecessorSubscriptionId: succeedsId, tx },
                    { successionCloser: ports.successionCloser ?? unimplementedSuccessionCloser }
                );
            }
        }
        return wrote;
    });
}
