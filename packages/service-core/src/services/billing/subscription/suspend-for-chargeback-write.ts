import type { Clock } from '@repo/billing-verticals-contract';
import { and, eq, getDb, isNull, subscriptionPauses, subscriptions } from '@repo/db';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports';
import { recordCoverageLossIfUncovered } from '../coverage/coverage-loss';
import { closeOpenPause } from './cancel-paused-subscription-support';
import { findSubscriptionProhibition } from './subscription-prohibited-transitions';
import { createSuccessorCutter, type SuccessorCutResult } from './successor-cutter';

/** A guarded S6 write and its S31 result. */
export type ChargebackSuspensionWrite =
    | { readonly kind: 'LOST_RACE' | 'NOT_COURTESY_PAUSE' }
    | {
          readonly kind: 'SUSPENDED';
          readonly row: {
              readonly id: string;
              readonly userId: string | null;
              readonly vertical: string | null;
          };
          readonly cut: SuccessorCutResult;
      };

/** Locks the origin, closes a courtesy pause, writes S6, then cuts S31 in the same transaction. */
export async function writeChargebackSuspension(input: {
    readonly subscriptionId: string;
    readonly origin: 'ACTIVE' | 'GRACE_PERIOD' | 'PAUSED';
    readonly now: Date;
    readonly readAt: Date;
    readonly clock: Clock;
    readonly orphanhood: AddonOrphanhoodPorts;
}): Promise<ChargebackSuspensionWrite> {
    return getDb().transaction(async (tx) => {
        const [locked] = await tx
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, input.subscriptionId))
            .limit(1)
            .for('update');
        if (locked?.status !== input.origin) return { kind: 'LOST_RACE' };
        if (input.origin === 'PAUSED') {
            const [pause] = await tx
                .select({ id: subscriptionPauses.id, reason: subscriptionPauses.reason })
                .from(subscriptionPauses)
                .where(
                    and(
                        eq(subscriptionPauses.subscriptionId, input.subscriptionId),
                        isNull(subscriptionPauses.actualEndAt)
                    )
                )
                .limit(1);
            if (pause?.reason !== 'COURTESY') return { kind: 'NOT_COURTESY_PAUSE' };
            if (
                findSubscriptionProhibition({
                    from: 'PAUSED',
                    to: 'SUSPENDED',
                    exception: 'S6_CHARGEBACK_ON_COURTESY'
                }) !== null
            )
                throw new Error('PROH:B:4 forbids the courtesy chargeback suspension');
            await closeOpenPause({ tx, pauseId: pause.id, now: input.now });
        }
        const [row] = await tx
            .update(subscriptions)
            .set({
                status: 'SUSPENDED',
                ...(input.origin === 'GRACE_PERIOD'
                    ? {}
                    : {
                          graceStartedAt: input.readAt,
                          graceEndsAt: input.readAt
                      }),
                updatedAt: input.now
            })
            .where(
                and(
                    eq(subscriptions.id, input.subscriptionId),
                    eq(subscriptions.status, input.origin)
                )
            )
            .returning({
                id: subscriptions.id,
                userId: subscriptions.userId,
                vertical: subscriptions.vertical
            });
        if (!row) return { kind: 'LOST_RACE' };
        if (row.userId)
            await recordCoverageLossIfUncovered({
                tx,
                userId: row.userId,
                vertical: row.vertical ?? '',
                lostAt: input.now,
                clock: { now: () => input.now }
            });
        const cut = await createSuccessorCutter({
            clock: input.clock,
            orphanhood: input.orphanhood
        }).cutSuccessor({ predecessorSubscriptionId: input.subscriptionId, tx });
        return { kind: 'SUSPENDED', row, cut };
    });
}
