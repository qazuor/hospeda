import { and, type DrizzleClient, eq, getDb, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { VerticalEnumSchema } from '@repo/schemas';
import { recordCoverageLossIfUncovered } from '../coverage/coverage-loss';
import type { CoverageNotices } from '../payment/payment-ports';
import { hasOpenRetention } from './succession-retained-payment';

const logger = createLogger('suspend-for-arrears');

/** What the single write of S6 did. */
export type ArrearsSuspensionWrite = 'SUSPENDED' | 'LOST_RACE' | 'RETAINED_PAYMENT';

/**
 * S6 ends the provider-side grace too when a provider pause is observed from
 * `ACTIVE`: DEC-MP-008 says the provider has given up, so our grace has ended.
 * S7 binds condition 4 to `grace_started_at`; HOS-1690 writes the suspension
 * instant as its anchor. A row already in `GRACE_PERIOD` keeps S4's clock.
 */
const GRACE_CLOCK_BY_ORIGIN: Record<
    'ACTIVE' | 'GRACE_PERIOD',
    (now: Date) => { readonly graceStartedAt?: Date; readonly graceEndsAt?: Date }
> = {
    ACTIVE: (now) => ({ graceStartedAt: now, graceEndsAt: now }),
    GRACE_PERIOD: () => ({})
};

/** S6's guarded write inside the caller's transaction. The caller owns post-commit notices. */
export async function writeArrearsSuspensionInTx(
    input:
        | {
              readonly tx: DrizzleClient;
              readonly subscriptionId: string;
              readonly origin: 'ACTIVE';
              readonly now: Date;
              readonly readAt: Date;
          }
        | {
              readonly tx: DrizzleClient;
              readonly subscriptionId: string;
              readonly origin: 'GRACE_PERIOD';
              readonly now: Date;
          }
): Promise<
    | { readonly kind: 'LOST_RACE' }
    | { readonly kind: 'RETAINED_PAYMENT' }
    | {
          readonly kind: 'SUSPENDED';
          readonly row: {
              readonly id: string;
              readonly userId: string | null;
              readonly vertical: string | null;
          };
      }
> {
    const { tx } = input;
    const [locked] = await tx
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1)
        .for('update');
    if (locked?.status !== input.origin) return { kind: 'LOST_RACE' as const };
    if (await hasOpenRetention({ subscriptionId: input.subscriptionId, tx }))
        return { kind: 'RETAINED_PAYMENT' as const };
    const [row] = await tx
        .update(subscriptions)
        .set({
            status: 'SUSPENDED',
            ...GRACE_CLOCK_BY_ORIGIN[input.origin](
                input.origin === 'ACTIVE' ? input.readAt : input.now
            ),
            updatedAt: input.now
        })
        .where(
            and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.status, input.origin))
        )
        .returning({
            id: subscriptions.id,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical
        });
    if (!row) return { kind: 'LOST_RACE' as const };
    // Coverage loss belongs to the same transaction as the suspension.
    if (row.userId)
        await recordCoverageLossIfUncovered({
            tx,
            userId: row.userId,
            vertical: row.vertical ?? '',
            lostAt: input.now,
            clock: { now: () => input.now }
        });
    return { kind: 'SUSPENDED' as const, row };
}

/** Emits the S6 coverage removal after the subscription commit. */
export async function emitArrearsSuspensionCoverageChanged(input: {
    readonly row: {
        readonly id: string;
        readonly userId: string | null;
        readonly vertical: string | null;
    };
    readonly coverageNotices: CoverageNotices;
}): Promise<void> {
    const vertical = VerticalEnumSchema.safeParse(input.row.vertical);
    if (input.row.userId && vertical.success) {
        try {
            await input.coverageNotices.emitCoverageChanged({
                userId: input.row.userId,
                vertical: vertical.data,
                sourceType: 'SUBSCRIPTION',
                change: 'REMOVED'
            });
        } catch (error) {
            logger.error(
                { subscriptionId: input.row.id, error },
                'Coverage changed notice failed after suspension commit'
            );
        }
    } else {
        logger.error(
            { subscriptionId: input.row.id, vertical: input.row.vertical },
            'Suspended subscription has no coverage subject to notify'
        );
    }
}

/**
 * The single write of S6 plus its post-commit coverage notice (G5 `via: "notice"`):
 * `<origin> → SUSPENDED`, then `REMOVED` is emitted once the transaction committed.
 * Inside the transaction the row is locked first and S19 is asked again (HOS-1561
 * H5): with an open retention nothing is written (`RETAINED_PAYMENT`: neither the
 * `UPDATE` nor the coverage-loss row) and an error is logged, because the
 * authorization was already cancelled by then. S19 locks the same row, so the two
 * serialize. A notice failure is logged and undoes nothing. When no source is left,
 * the same transaction records the coverage-loss instant
 * (`recordCoverageLossIfUncovered`, contract §4.1) right after the `UPDATE`, so it
 * survives a lost notice. From `GRACE_PERIOD`, the grace clock written by S4 is
 * kept. From `ACTIVE` (the second event only), S6 writes the authorization
 * provider-read instant
 * as the unpaid-period anchor so S7 can bind condition 4 to it (HOS-1690); S7
 * empties both values when the row leaves.
 *
 * @param input.subscriptionId - The row being suspended
 * @param input.origin - The status the event leaves (the `UPDATE` guard)
 * @param input.now - The write instant
 * @param input.readAt - The provider-read instant, required from `ACTIVE`
 * @param input.coverageNotices - The coverage listener (B4.2 wires it)
 * @returns `SUSPENDED` when this call moved the row; `LOST_RACE` when it was no
 *   longer in the origin; `RETAINED_PAYMENT` when S19 retained a payment meanwhile
 */
export async function writeArrearsSuspension(
    input:
        | {
              readonly subscriptionId: string;
              readonly origin: 'ACTIVE';
              readonly now: Date;
              readonly readAt: Date;
              readonly coverageNotices: CoverageNotices;
          }
        | {
              readonly subscriptionId: string;
              readonly origin: 'GRACE_PERIOD';
              readonly now: Date;
              readonly coverageNotices: CoverageNotices;
          }
): Promise<ArrearsSuspensionWrite> {
    const written = await getDb().transaction((tx) => writeArrearsSuspensionInTx({ ...input, tx }));
    if (written.kind === 'RETAINED_PAYMENT') {
        logger.error(
            { subscriptionId: input.subscriptionId },
            'S19 retained a payment of the period after the arrears guard; the authorization is already cancelled and the row is not suspended'
        );
        return 'RETAINED_PAYMENT';
    }
    if (written.kind === 'LOST_RACE') return 'LOST_RACE';
    const updated = written.row;

    await emitArrearsSuspensionCoverageChanged({
        row: updated,
        coverageNotices: input.coverageNotices
    });
    return 'SUSPENDED';
}
