import type { DrizzleClient } from '@repo/db';
import { z } from 'zod';
import { isLiveSuccessionPredecessor } from './late-payment-conditions';
import type { SuccessionCloser } from './subscription-billing-ports';

const inputSchema = z.strictObject({ predecessorSubscriptionId: z.uuid() });

/** Result of {@link closeSuccessionIfPredecessor}. */
export interface CloseSuccessionIfPredecessorResult {
    /** True when a live successor pointed at the row and the closer was called. */
    readonly called: boolean;
}

/**
 * The act that ends a succession from the predecessor's side (AC:B7:25, `12` §5.3
 * branches 1, 5 and 6; HOS-1561 H8): with the caller's transaction it looks for a
 * live PRINCIPAL successor (`LIVE_SUBSCRIPTION_STATUSES`, glossary «fila viva»
 * row 8) whose `succeeds_id` is the predecessor and, when there is one, calls S18
 * through its internal interface (`SuccessionCloser`, implemented by B8b) in that
 * same transaction, so the close happens in the act that ends the succession.
 *
 * Callers:
 * - branch 1: `activatePendingWithSignupNotice` (the successor authorizes, S2);
 * - branch 5: `mirrorProviderCancellationOnGrace` (the provider cancels the
 *   predecessor while it is in `GRACE_PERIOD`, `B/03` §10.1);
 * - branch 6: S36 (B5.7, HOS-1547) and S23/S24 (B8a, HOS-1570), once the
 *   predecessor is `CANCELLED`.
 *
 * Without a live successor nothing is called. A read error or a closer error is
 * thrown, so the caller's transaction rolls back (fails closed).
 *
 * @param input.predecessorSubscriptionId - The row that may be a predecessor
 * @param input.tx - The caller's transaction
 * @param ports.successionCloser - S18's interface
 * @returns Whether the closer was called
 */
export async function closeSuccessionIfPredecessor(
    input: { readonly predecessorSubscriptionId: string; readonly tx: DrizzleClient },
    ports: { readonly successionCloser: SuccessionCloser }
): Promise<CloseSuccessionIfPredecessorResult> {
    const { predecessorSubscriptionId } = inputSchema.parse({
        predecessorSubscriptionId: input.predecessorSubscriptionId
    });
    const live = await isLiveSuccessionPredecessor({
        subscriptionId: predecessorSubscriptionId,
        tx: input.tx
    });
    if (!live) return { called: false };
    await ports.successionCloser.closeSuccession({ predecessorSubscriptionId, tx: input.tx });
    return { called: true };
}
