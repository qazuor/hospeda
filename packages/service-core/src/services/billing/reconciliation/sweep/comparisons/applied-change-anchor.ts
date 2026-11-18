import { and, asc, type DrizzleClient, domainEvent, eq } from '@repo/db';

/** A subscription's plan version and billing option pair. */
export interface SubscriptionAnchor {
    readonly planVersionId: string;
    readonly billingOptionId: string;
}

/** Field the S38 event uses to record the instant the applied change took effect (HOS-2345). */
export const SCHEDULED_CHANGE_EFFECTIVE_AT_FIELD = 'effective_at';

interface EventChange {
    readonly field: string;
    readonly old?: unknown;
    readonly new?: unknown;
}

function stringChange(
    changes: readonly EventChange[],
    field: string,
    side: 'old' | 'new'
): string | null {
    const value = changes.find((change) => change.field === field)?.[side];
    return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * The instant from which an applied change's new anchor governs charges: the queued
 * `effective_at` the event records, or, for events written before HOS-2345, the
 * instant S38 applied it.
 */
function boundaryOf(event: {
    readonly occurredAt: Date;
    readonly changes: readonly EventChange[];
}): Date {
    const recorded = stringChange(event.changes, SCHEDULED_CHANGE_EFFECTIVE_AT_FIELD, 'new');
    const parsed = recorded ? new Date(recorded) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : event.occurredAt;
}

/**
 * HOS-2345: resolves the anchor that governed a charge made at `at`, from the
 * `subscription.scheduled_change_applied` (S38) events. S38 is the only writer that
 * moves a live subscription's anchor to a different price, and it deletes its queue
 * row, so the events are the only record of the previous anchor.
 *
 * Returns the `old` pair of the first applied change whose boundary falls after `at`,
 * or `null` when no applied change happened after `at` (the current anchor governs).
 */
export async function readAnchorInForceAt(input: {
    readonly subscriptionId: string;
    readonly at: Date;
    readonly executor: DrizzleClient;
}): Promise<SubscriptionAnchor | null> {
    const events = await input.executor
        .select({ occurredAt: domainEvent.occurredAt, changes: domainEvent.changes })
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityType, 'subscription'),
                eq(domainEvent.entityId, input.subscriptionId),
                eq(domainEvent.eventType, 'subscription.scheduled_change_applied')
            )
        )
        .orderBy(asc(domainEvent.occurredAt), asc(domainEvent.seq));
    const next = events.find((event) => boundaryOf(event).getTime() > input.at.getTime());
    if (!next) return null;
    const planVersionId = stringChange(next.changes, 'plan_version_id', 'old');
    const billingOptionId = stringChange(next.changes, 'billing_option_id', 'old');
    return planVersionId && billingOptionId ? { planVersionId, billingOptionId } : null;
}
