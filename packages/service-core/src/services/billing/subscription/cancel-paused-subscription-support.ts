import type { DrizzleClient } from '@repo/db';
import { and, eq, isNull, subscriptionPauses, subscriptions } from '@repo/db';
import type { CancellationReasonSchema } from '@repo/schemas';
import type { z } from 'zod';
import type { AddonProviderCancellationResult } from '../addon/addon-instance-a5.js';
import type { CancelActiveCall } from './cancel-active-subscription.service.js';
import type { DecidedComplementCancellationCall } from './complement-s11-rule.js';

/** S22's stable outcomes, including typed precondition failures. */
export type CancelPausedSubscriptionResult =
    | { readonly outcome: 'REJECTED'; readonly reason: 'NOT_PAUSED' | 'NO_OPEN_PAUSE' }
    | { readonly outcome: 'LOST_RACE' }
    | { readonly outcome: 'ALREADY_CANCELLED'; readonly serviceEndsAt: Date | null }
    | { readonly outcome: 'ALREADY_SCHEDULED'; readonly serviceEndsAt: Date }
    | {
          readonly outcome: 'CANCELLED';
          readonly serviceEndsAt: Date;
          readonly cancelCall: CancelActiveCall;
          readonly successionClosed: boolean;
          readonly orphanedAddonIds: readonly string[];
          readonly addonCancelCalls: readonly AddonProviderCancellationResult[];
          readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
      }
    | {
          readonly outcome: 'SCHEDULED';
          readonly serviceEndsAt: Date;
          readonly basis: 'PAID_PERIOD' | 'CREDIT' | 'NOW';
          readonly cancelCall: CancelActiveCall;
          readonly complements: {
              readonly decided: number;
              readonly calls: readonly DecidedComplementCancellationCall[];
          };
          readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
      };

/** S22's guarded PAUSED to CANCELLED write, registered as a turns-off writer by G5. */
export async function writePausedCancellation(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly now: Date;
    readonly reason?: z.infer<typeof CancellationReasonSchema>;
}): Promise<boolean> {
    const [row] = await input.tx
        .update(subscriptions)
        .set({
            status: 'CANCELLED',
            serviceEndsAt: input.now,
            updatedAt: input.now,
            cancellationReason: input.reason ?? null
        })
        .where(and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.status, 'PAUSED')))
        .returning({ id: subscriptions.id });
    return row !== undefined;
}

/** S22's guarded PAUSED to CANCEL_SCHEDULED write, registered as neutral by G5. */
export async function writePausedScheduledCancellation(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly now: Date;
    readonly serviceEndsAt: Date;
    readonly reason?: z.infer<typeof CancellationReasonSchema>;
}): Promise<boolean> {
    const [row] = await input.tx
        .update(subscriptions)
        .set({
            status: 'CANCEL_SCHEDULED',
            serviceEndsAt: input.serviceEndsAt,
            updatedAt: input.now,
            cancellationReason: input.reason ?? null
        })
        .where(and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.status, 'PAUSED')))
        .returning({ id: subscriptions.id });
    return row !== undefined;
}

/** Closes exactly the pause whose open id was read under the principal lock. */
export async function closeOpenPause(input: {
    readonly tx: DrizzleClient;
    readonly pauseId: string;
    readonly now: Date;
}): Promise<void> {
    const [row] = await input.tx
        .update(subscriptionPauses)
        .set({ actualEndAt: input.now })
        .where(
            and(eq(subscriptionPauses.id, input.pauseId), isNull(subscriptionPauses.actualEndAt))
        )
        .returning({ id: subscriptionPauses.id });
    if (!row) throw new Error('S22 open pause changed under principal lock');
}
