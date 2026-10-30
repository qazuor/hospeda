import type { Clock } from '@repo/billing-verticals-contract';
import { and, domainEventModel, eq, getDb, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { recordCoverageLossIfUncovered } from '../coverage/coverage-loss.js';
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
 * so, still in that transaction, it records the coverage loss when no other source is left
 * (`recordCoverageLossIfUncovered`, the same call and order as the receiver's
 * `PROVIDER_CANCEL` branch; HOS-1676 Coord-376), and the `REMOVED` coverage notice is
 * emitted after the commit; a notice error is only logged. A closer error rolls the
 * cancellation back.
 *
 * Registered as the `CANCELLED_ON_GRACE` delegate by `createProviderNoticeMirrorDelegates`
 * (`provider-notice-delegates.ts`, HOS-1676). In the same transaction as the cancellation it
 * writes `subscription.provider_cancelled_after_rejection` (HOS-1676 H-2): a row in grace is
 * one whose charge was rejected, and `canCharge` and the `LIVE_PREAPPROVAL_ON_CLOSED_ROW` pair
 * read that event to tell this `CANCELLED` apart from every other one.
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
        const cancelledAt = ports.clock.now();
        const [row] = await tx
            .update(subscriptions)
            .set({
                status: 'CANCELLED',
                serviceEndsAt: value.readAt,
                graceStartedAt: null,
                graceEndsAt: null,
                updatedAt: cancelledAt
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
        // The mark of «cancelled by the provider after a rejection» (HOS-1676 H-2): same
        // transaction as the drop, so a rolled-back cancellation leaves no event.
        await domainEventModel.insert({
            eventType: 'subscription.provider_cancelled_after_rejection',
            entityType: 'subscription',
            entityId: value.subscriptionId,
            actorType: 'provider',
            actorId: null,
            correlationId: crypto.randomUUID(),
            changes: [{ field: 'status', old: 'GRACE_PERIOD', new: 'CANCELLED' }],
            reason: 'CANCELLED_ON_GRACE',
            occurredAt: value.readAt,
            tx
        });
        const closed = await closeSuccessionIfPredecessor(
            { predecessorSubscriptionId: value.subscriptionId, tx },
            { successionCloser: ports.successionCloser }
        );
        // coberturaPerdidaEn in the same transaction as the drop, after S18, in the same order as
        // the receiver's PROVIDER_CANCEL branch (contract §4.1; I-5; HOS-1676 Coord-376).
        if (row.userId)
            await recordCoverageLossIfUncovered({
                tx,
                userId: row.userId,
                vertical: row.vertical ?? '',
                lostAt: cancelledAt,
                clock: ports.clock
            });
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
