import type { Clock } from '@repo/billing-verticals-contract';
import { and, domainEvent, eq, reconciliationMarks, subscriptions } from '@repo/db';
import { applyS12ToPrincipal } from '../../../../src/services/billing/subscription/service-end-s12.js';
import { getServiceTestDb } from '../helpers.js';

/** Reads only this subscription's marks for the prohibited transition reason. */
export async function transitionMarksOf(subscriptionId: string) {
    return getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(
            and(
                eq(reconciliationMarks.subscriptionId, subscriptionId),
                eq(reconciliationMarks.reason, 'TRANSICION_NO_DECLARADA')
            )
        );
}

/** Reads this subscription's rule 1 events that record a status attempt. */
export async function transitionAttemptEvents(subscriptionId: string) {
    const events = await getServiceTestDb()
        .select()
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityType, 'subscription'),
                eq(domainEvent.entityId, subscriptionId),
                eq(domainEvent.eventType, 'reconciliation.mark_opened')
            )
        );
    return events.filter((event) =>
        (event.changes ?? []).some((change) => change.field === 'subscription.status')
    );
}

/** Reads the state columns rule 1 must preserve. */
export async function rowState(subscriptionId: string) {
    const [row] = await getServiceTestDb()
        .select({
            status: subscriptions.status,
            serviceEndsAt: subscriptions.serviceEndsAt,
            graceStartedAt: subscriptions.graceStartedAt,
            graceEndsAt: subscriptions.graceEndsAt,
            class: subscriptions.class
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    if (!row) throw new Error(`subscription ${subscriptionId} missing`);
    return row;
}

/** Runs declared S12 against a due scheduled principal. */
export async function closeByS12(input: {
    readonly subscriptionId: string;
    readonly clock: Clock;
    readonly at: Date;
}) {
    return getServiceTestDb().transaction(async (tx) =>
        applyS12ToPrincipal(
            { tx, subscriptionId: input.subscriptionId, now: input.at },
            {
                clock: input.clock,
                orphanhood: {
                    addonPolicy: async () => {
                        throw new Error('unexpected addon policy read');
                    },
                    listing: async () => {
                        throw new Error('unexpected addon listing read');
                    }
                }
            }
        )
    );
}
