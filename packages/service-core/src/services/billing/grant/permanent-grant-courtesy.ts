import type { COURTESY_CLOSE_REASONS } from '@repo/db';
import {
    and,
    courtesyGrants,
    type DrizzleClient,
    eq,
    inArray,
    isNotNull,
    isNull,
    subscriptions
} from '@repo/db';

/**
 * S13 closes deferred courtesy balances where a permanent grant adds coverage.
 * DEC-GRANT-013 and TRANS:B:S13 (B/14 §4.3): «Escribir un cierre ya escrito no escribe nada».
 */
export async function closeDeferredCourtesyBalances(input: {
    readonly tx: DrizzleClient;
    readonly beneficiaryUserId: string;
    readonly verticals: readonly string[];
    readonly now: Date;
}): Promise<{ readonly closedCourtesyIds: readonly string[] }> {
    if (input.verticals.length === 0) return { closedCourtesyIds: [] };
    const rows = await input.tx
        .update(courtesyGrants)
        .set({
            balanceClosedAt: input.now,
            closeReason:
                'GRANT_PERMANENTE_OTORGADO' satisfies (typeof COURTESY_CLOSE_REASONS)[number]
        })
        .where(
            and(
                eq(courtesyGrants.beneficiaryUserId, input.beneficiaryUserId),
                isNotNull(courtesyGrants.balanceMonths),
                isNull(courtesyGrants.balanceClosedAt),
                inArray(
                    courtesyGrants.subscriptionId,
                    input.tx
                        .select({ id: subscriptions.id })
                        .from(subscriptions)
                        .where(
                            and(
                                eq(subscriptions.userId, input.beneficiaryUserId),
                                inArray(subscriptions.vertical, [...input.verticals])
                            )
                        )
                )
            )
        )
        .returning({ id: courtesyGrants.id });
    return { closedCourtesyIds: rows.map(({ id }) => id) };
}
