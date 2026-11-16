import { and, coveredPeriods, type DrizzleClient, eq, isNull, subscriptions } from '@repo/db';

/**
 * HOS-2223: whether a succession predecessor has a credited charge, the fact that turns its
 * `next_charge_at` into the end of a paid cycle for `resolveSuccessorWindow`.
 *
 * Source: an open `covered_period` row (`released_at IS NULL`) of the subscription, from an
 * automatic (`payment_id`) or a manual (`manual_payment_id`) payment. That row is written only
 * when a payment is credited (P1 `creditPayment`, or a registered manual payment) and released
 * when it is refunded, so it is the ledger of "this subscription has been paid", not a
 * provider claim.
 *
 * Deliberately not narrowed to "the period covering now": a predecessor that was paid once and
 * is waiting on its next charge keeps its window cut at that charge, as before HOS-2223. Only a
 * subscription that never had a charge credited (S2 copied the provider's first-charge instant)
 * is offered the full window.
 *
 * @param input.tx - Transaction or client to read with
 * @param input.subscriptionId - The predecessor subscription
 * @returns `hasCreditedCharge` true when an open covered period exists
 */
export async function readHasCreditedCharge(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
}): Promise<{ readonly hasCreditedCharge: boolean }> {
    const rows = await input.tx
        .select({ id: coveredPeriods.id })
        .from(coveredPeriods)
        .where(
            and(
                eq(coveredPeriods.subscriptionId, input.subscriptionId),
                isNull(coveredPeriods.releasedAt)
            )
        )
        .limit(1);
    return { hasCreditedCharge: rows.length > 0 };
}

/** The predecessor facts the successor window is decided on, read under its row lock. */
export interface LockedSuccessorWindowPredecessor {
    readonly status: string;
    readonly paymentMethod: string | null;
    readonly nextChargeAt: Date | null;
    readonly hasCreditedCharge: boolean;
}

/**
 * HOS-2223: locks the predecessor row (`FOR UPDATE`) and re-reads every input of
 * `resolveSuccessorWindow`, so S1 decides the window and persists the successor while P1
 * cannot credit a charge in between. P1 (`creditPayment`) takes the same row lock before it
 * opens the `covered_period`, so the two serialize on this one row.
 *
 * Call it as the FIRST statement that touches the predecessor in the transaction that inserts
 * the successor: S1 holds no other lock at that point, and P1 acquires payment then
 * subscription, so no lock cycle can form.
 *
 * @param input.tx - The successor's insert transaction
 * @param input.subscriptionId - The predecessor subscription
 * @returns The predecessor's window inputs, or `null` when the row does not exist
 */
export async function readLockedSuccessorWindowPredecessor(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
}): Promise<LockedSuccessorWindowPredecessor | null> {
    const [row] = await input.tx
        .select({
            status: subscriptions.status,
            paymentMethod: subscriptions.paymentMethod,
            nextChargeAt: subscriptions.nextChargeAt
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1)
        .for('update');
    if (!row) return null;
    const { hasCreditedCharge } = await readHasCreditedCharge(input);
    return { ...row, hasCreditedCharge };
}
