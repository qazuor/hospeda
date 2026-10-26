import type { SelectSubscription } from '@repo/db';
import { VerticalEnumSchema } from '@repo/schemas';
import type { BillingFact } from './billing-fact-sink.js';

type SuspendedFact = Extract<BillingFact, { kind: 'SUSPENDED_FOR_ARREARS' }>;

/** Builds the analytics fact for a committed suspension of a principal subscription. */
export function buildSuspendedFact(input: {
    readonly subscription: SelectSubscription;
    readonly occurredAt: Date;
    readonly trigger: SuspendedFact['trigger'];
    readonly occurrenceId: string;
}): SuspendedFact | undefined {
    const { subscription, occurredAt } = input;
    const vertical = VerticalEnumSchema.safeParse(subscription.vertical);
    if (!subscription.userId || !vertical.success) return undefined;
    return {
        kind: 'SUSPENDED_FOR_ARREARS',
        userId: subscription.userId,
        vertical: vertical.data,
        subscriptionId: subscription.id,
        subscriptionClass: 'PRINCIPAL',
        actorKind: 'SYSTEM',
        occurredAt,
        trigger: input.trigger,
        occurrenceId: input.occurrenceId,
        ...(subscription.graceStartedAt
            ? {
                  daysInGrace: Math.max(
                      0,
                      Math.floor(
                          (occurredAt.getTime() - subscription.graceStartedAt.getTime()) /
                              86_400_000
                      )
                  )
              }
            : {})
    };
}
