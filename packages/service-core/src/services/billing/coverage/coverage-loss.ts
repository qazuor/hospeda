/**
 * The instant of the latest coverage loss of a `(user, vertical)` (`coberturaPerdidaEn`, contract
 * §4.1; AC:B4:4): «La implementación real lo guarda en la misma transacción que escribe la caída de
 * cobertura». The coverage-changed notice is emitted after the commit with no durable delivery
 * (DEC-ARCH-009📌2), so `retentionStopped` answers this instant even when that notice is delayed or
 * lost: it never waits for the reconciler nor for a queue.
 */
import { type Clock, VerticalSchema } from '@repo/billing-verticals-contract';
import { coverageLosses, type DrizzleClient, sql } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { noCreditedPayments } from '../subscription/subscription-billing-ports';
import { resolveSubscriptionSources } from './subscription-sources';

/**
 * Records the coverage loss of a `(user, vertical)` inside the writer's own transaction, when the
 * write that just turned a billing source off left none (I-5).
 *
 * Call it INSIDE the transaction of a `turns-off` writer (S6, S16, the provider's cancellation),
 * after its `UPDATE` and before the commit: a rollback then drops the instant together with the
 * drop, and a commit keeps both. It reads the `SUBSCRIPTION` sources with that same `tx`; when one
 * is left (a successor already authorized, another live principal) nothing is written. The trial is
 * not looked at: if a trial still covers, the instant is written anyway, the safe side (PB9 counts
 * from the latest instant and deletes later, never earlier). The row keeps the latest loss:
 * `lost_at = GREATEST(coverage_loss.lost_at, EXCLUDED.lost_at)`.
 *
 * @param input.tx - The writer's transaction (mandatory)
 * @param input.userId - The person whose source went off
 * @param input.vertical - The vertical of that source; anything outside the contract's verticals throws
 * @param input.lostAt - The writer's own write instant (its `updatedAt`)
 * @param input.clock - The writer's clock, for the `until` of the sources still emitted
 * @returns `{ recorded }`: whether the loss was written
 */
export async function recordCoverageLossIfUncovered(input: {
    readonly tx: DrizzleClient;
    readonly userId: string;
    readonly vertical: string;
    readonly lostAt: Date;
    readonly clock: Clock;
}): Promise<{ readonly recorded: boolean }> {
    const vertical = VerticalSchema.safeParse(input.vertical);
    if (!vertical.success) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            `Cannot record a coverage loss in vertical "${input.vertical}": not a contract vertical`,
            undefined,
            'COVERAGE_LOSS_UNKNOWN_VERTICAL'
        );
    }
    const { sources } = await resolveSubscriptionSources({
        userId: input.userId,
        vertical: vertical.data,
        ports: { clock: input.clock, payments: noCreditedPayments },
        tx: input.tx
    });
    if (sources.length > 0) return { recorded: false };

    await input.tx
        .insert(coverageLosses)
        .values({ userId: input.userId, vertical: vertical.data, lostAt: input.lostAt })
        .onConflictDoUpdate({
            target: [coverageLosses.userId, coverageLosses.vertical],
            set: {
                lostAt: sql`GREATEST("coverage_loss"."lost_at", excluded."lost_at")`,
                updatedAt: sql`now()`
            }
        });
    return { recorded: true };
}
