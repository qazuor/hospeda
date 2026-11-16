import { and, coveredPeriods, type DrizzleClient, eq, isNull } from '@repo/db';

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
