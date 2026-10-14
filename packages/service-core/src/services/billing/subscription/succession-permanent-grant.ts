import { and, type DrizzleClient, inArray, isNull, successionRetainedPayments } from '@repo/db';
import { createLogger } from '@repo/logger';
import { z } from 'zod';
import type { SuccessionRetainedPaymentReleaseReason } from './succession-retained-payment';

const logger = createLogger('succession-permanent-grant');
const inputSchema = z.strictObject({ subscriptionIds: z.array(z.uuid()), now: z.date() });

/** The act that turns the S19 flag off on branch 4: a *Free Forever* grant (S13). */
const PERMANENT_GRANT: SuccessionRetainedPaymentReleaseReason = 'PERMANENT_GRANT';

/** Input of the branch 4 release: the rows S13 reaches, the act's instant and S13's transaction. */
export interface PermanentGrantRetentionReleaseInput {
    readonly subscriptionIds: readonly string[];
    readonly now: Date;
    readonly tx: DrizzleClient;
}

/** Result of the branch 4 release: the retentions whose S19 flag was turned off. */
export interface PermanentGrantRetentionReleaseResult {
    readonly releasedRetentionIds: readonly string[];
}

/**
 * The internal interface S13 (B9a) calls in its own transaction, with the rows the
 * grant reaches, to turn off the S19 flag of `12` §5.3 branch 4 (AC:B7:26). B7 writes
 * the branch entirely (DEC-ARCH-017📌7); B9a imports it and does not edit this file
 * (AC:B9a:17, TEST:B9a:17).
 */
export interface PermanentGrantRetentionRelease {
    /** Turns off every open S19 retention of the given rows, without refund. */
    releaseOnPermanentGrant(
        input: PermanentGrantRetentionReleaseInput
    ): Promise<PermanentGrantRetentionReleaseResult>;
}

/**
 * Branch 4 of `12` §5.3 (AC:B7:26): a *Free Forever* grant falls on a succession and
 * «`S13` apaga la bandera en el mismo acto» over «las dos» rows. With S13's transaction
 * it closes every OPEN retention (`released_at IS NULL`) of the given rows with
 * `released_at = now` and `PERMANENT_GRANT`. The payment is NOT refunded: a declared
 * exception of DEC-GRANT-001 («no se devuelve lo pagado»). Matching by row and not by
 * payment also reaches a manual-payment retention (Phase 4), whose `payment_id` is null.
 *
 * It refunds nothing, opens no mark, does not call S18 (TRANS:B:S13: «No corre `S18`»),
 * changes no row's status and writes no `domain_event`: those are S13's. A retention
 * another branch already closed keeps its reason, so a second call releases nothing.
 * An empty list is a no-op without a query. A write error is thrown, so S13's
 * transaction rolls back (fails closed).
 *
 * @param input.subscriptionIds - The rows S13 reaches (predecessor and successor)
 * @param input.now - The instant of S13's act
 * @param input.tx - S13's transaction
 * @returns The ids of the retentions that were turned off
 */
export async function releaseRetainedPaymentsOnPermanentGrant(
    input: PermanentGrantRetentionReleaseInput
): Promise<PermanentGrantRetentionReleaseResult> {
    const { subscriptionIds, now } = inputSchema.parse({
        subscriptionIds: [...input.subscriptionIds],
        now: input.now
    });
    if (subscriptionIds.length === 0) return { releasedRetentionIds: [] };
    const released = await input.tx
        .update(successionRetainedPayments)
        .set({ releasedAt: now, releaseReason: PERMANENT_GRANT, updatedAt: now })
        .where(
            and(
                inArray(successionRetainedPayments.subscriptionId, [...subscriptionIds]),
                isNull(successionRetainedPayments.releasedAt)
            )
        )
        .returning({
            id: successionRetainedPayments.id,
            subscriptionId: successionRetainedPayments.subscriptionId,
            paymentId: successionRetainedPayments.paymentId
        });
    for (const retention of released)
        logger.info(
            {
                retentionId: retention.id,
                subscriptionId: retention.subscriptionId,
                paymentId: retention.paymentId,
                reason: PERMANENT_GRANT
            },
            'S19 retention released by a permanent grant, without refund'
        );
    return { releasedRetentionIds: released.map((retention) => retention.id) };
}

/** The branch 4 implementation S13 (B9a) calls (AC:B7:26). */
export const permanentGrantRetentionRelease: PermanentGrantRetentionRelease = {
    releaseOnPermanentGrant: releaseRetainedPaymentsOnPermanentGrant
};
