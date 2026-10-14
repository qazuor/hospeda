import { and, type DrizzleClient, eq, lte, subscriptionScheduledChanges } from '@repo/db';
import { z } from 'zod';
import type { ScheduledChangeApplier } from './subscription-billing-ports';

const inputSchema = z.strictObject({ subscriptionId: z.uuid(), now: z.date() });

/** Result of {@link applyOverdueScheduledChangeOnReturn}. */
export interface ApplyOverdueScheduledChangeOnReturnResult {
    /** True when the row had a due scheduled change and S38 was called. */
    readonly called: boolean;
}

/**
 * The act of S7 that hands a due scheduled change to S38 (AC:B7:28; TRANS:B:S7: «si la
 * fila tiene en la cola un cambio programado cuya fecha pasó mientras estaba suspendida,
 * al volver lo aplica `S38` … vuelva a `ACTIVE` o a `CANCEL_SCHEDULED`»; DEC-ARCH-017📌6).
 *
 * With the caller's transaction it reads the row's entry in `subscription_scheduled_change`
 * (at most one per subscription) whose `effective_at` is at or before `now`; when there is
 * one it calls S38 through its internal interface (`ScheduledChangeApplier`, implemented
 * by B8b) in that same transaction. It never deletes nor edits the queue entry: applying
 * the change and emptying the queue is S38's.
 *
 * A read error or an applier error is thrown, so the caller's transaction rolls back
 * (fails closed).
 *
 * @param input.subscriptionId - The row S7 just returned from `SUSPENDED`
 * @param input.now - The act's instant (S7's clock)
 * @param input.tx - S7's transaction
 * @param ports.scheduledChangeApplier - S38's interface
 * @returns Whether S38 was called
 */
export async function applyOverdueScheduledChangeOnReturn(
    input: { readonly subscriptionId: string; readonly now: Date; readonly tx: DrizzleClient },
    ports: { readonly scheduledChangeApplier: ScheduledChangeApplier }
): Promise<ApplyOverdueScheduledChangeOnReturnResult> {
    const { subscriptionId, now } = inputSchema.parse({
        subscriptionId: input.subscriptionId,
        now: input.now
    });
    const [due] = await input.tx
        .select({ id: subscriptionScheduledChanges.id })
        .from(subscriptionScheduledChanges)
        .where(
            and(
                eq(subscriptionScheduledChanges.subscriptionId, subscriptionId),
                lte(subscriptionScheduledChanges.effectiveAt, now)
            )
        )
        .limit(1);
    if (!due) return { called: false };
    await ports.scheduledChangeApplier.applyScheduledChange({ subscriptionId, tx: input.tx });
    return { called: true };
}
