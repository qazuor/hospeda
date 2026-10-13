import type { Clock } from '@repo/billing-verticals-contract';
import { and, eq, getDb, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports.js';
import type { SuccessionCloser } from '../subscription/subscription-billing-ports.js';
import { closeSuccessionIfPredecessor } from '../subscription/succession-end.js';

const logger = createLogger('mirror-cancelled-on-grace');

const inputSchema = z.strictObject({
    subscriptionId: z.uuid(),
    readAt: z.date()
});

/** Input of {@link mirrorProviderCancellationOnGrace}. */
export interface MirrorProviderCancellationOnGraceInput {
    /** The row the provider reports `cancelled` while it is in `GRACE_PERIOD`. */
    readonly subscriptionId: string;
    /** The instant of the provider read that saw the cancellation (`service_ends_at`). */
    readonly readAt: Date;
}

/** Ports of {@link mirrorProviderCancellationOnGrace}. */
export interface MirrorProviderCancellationOnGracePorts {
    readonly clock: Clock;
    /** S18's interface (B8b), called in the same transaction when a live successor points at the row. */
    readonly successionCloser: SuccessionCloser;
    /** Receives the post-commit `REMOVED` notice (B4.2); defaults to the unwired logger. */
    readonly coverageNotices?: CoverageNotices;
}

/** Result of {@link mirrorProviderCancellationOnGrace}. */
export type MirrorProviderCancellationOnGraceResult =
    | { readonly outcome: 'CANCELLED'; readonly successionClosed: boolean }
    | { readonly outcome: 'NOT_APPLICABLE'; readonly reason: 'NOT_FOUND' | 'NOT_IN_GRACE' };

/**
 * The `B/03` §10.1 mirror of `cancelled × GRACE_PERIOD` (mirror pair
 * `CANCELLED_ON_GRACE`) and branch 5 of `12` §5.3 (AC:B7:25; HOS-1561 H7-A): the
 * provider cancelled the authorization of a row in grace, so the row goes to
 * `CANCELLED`.
 *
 * In ONE transaction it re-reads and locks the row, requires `GRACE_PERIOD`
 * (otherwise `NOT_APPLICABLE`, nothing written), moves it to `CANCELLED` with
 * `service_ends_at = readAt` and an empty grace clock, and — when a live
 * successor points at it — calls S18 through `closeSuccessionIfPredecessor` with
 * that same transaction. `CANCELLED` emits no source (`03-contrato-de-cobertura.md:474`),
 * so the `REMOVED` coverage notice is emitted after the commit; a notice error is
 * only logged. A closer error rolls the cancellation back.
 *
 * Not registered in the API webhook: no mirror pair is registered yet (notes H7).
 *
 * @param input.subscriptionId - The row in grace
 * @param input.readAt - The provider read instant
 * @param ports - Clock, S18's interface and the coverage listener
 * @returns `CANCELLED`, or `NOT_APPLICABLE` with its reason
 */
export async function mirrorProviderCancellationOnGrace(
    input: MirrorProviderCancellationOnGraceInput,
    ports: MirrorProviderCancellationOnGracePorts
): Promise<MirrorProviderCancellationOnGraceResult> {
    const value = inputSchema.parse({ subscriptionId: input.subscriptionId, readAt: input.readAt });
    const written = await getDb().transaction(async (tx) => {
        const [locked] = await tx
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, value.subscriptionId))
            .limit(1)
            .for('update');
        if (!locked) return { kind: 'NOT_APPLICABLE' as const, reason: 'NOT_FOUND' as const };
        if (locked.status !== 'GRACE_PERIOD')
            return { kind: 'NOT_APPLICABLE' as const, reason: 'NOT_IN_GRACE' as const };
        const [row] = await tx
            .update(subscriptions)
            .set({
                status: 'CANCELLED',
                serviceEndsAt: value.readAt,
                graceStartedAt: null,
                graceEndsAt: null,
                updatedAt: ports.clock.now()
            })
            .where(
                and(
                    eq(subscriptions.id, value.subscriptionId),
                    eq(subscriptions.status, 'GRACE_PERIOD')
                )
            )
            .returning({
                id: subscriptions.id,
                userId: subscriptions.userId,
                vertical: subscriptions.vertical
            });
        if (!row) throw new Error('Locked grace row vanished before its cancellation');
        const closed = await closeSuccessionIfPredecessor(
            { predecessorSubscriptionId: value.subscriptionId, tx },
            { successionCloser: ports.successionCloser }
        );
        return { kind: 'CANCELLED' as const, row, successionClosed: closed.called };
    });
    if (written.kind === 'NOT_APPLICABLE') {
        logger.info(
            { subscriptionId: value.subscriptionId, reason: written.reason },
            'Provider cancellation on grace not applicable'
        );
        return { outcome: 'NOT_APPLICABLE', reason: written.reason };
    }

    const { row } = written;
    const vertical = VerticalEnumSchema.safeParse(row.vertical);
    if (row.userId && vertical.success) {
        try {
            await (ports.coverageNotices ?? unwiredCoverageNotices).emitCoverageChanged({
                userId: row.userId,
                vertical: vertical.data,
                sourceType: 'SUBSCRIPTION',
                change: 'REMOVED'
            });
        } catch (error) {
            logger.error(
                { subscriptionId: row.id, error },
                'Coverage changed notice failed after provider cancellation on grace commit'
            );
        }
    } else {
        logger.error(
            { subscriptionId: row.id, vertical: row.vertical },
            'Cancelled subscription has no coverage subject to notify'
        );
    }
    return { outcome: 'CANCELLED', successionClosed: written.successionClosed };
}
