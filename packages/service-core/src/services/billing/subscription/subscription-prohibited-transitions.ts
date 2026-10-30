import type { SUBSCRIPTION_STATUSES } from '@repo/db';

/** A subscription status known to the database schema. */
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Catalog identifiers for PROH:B:1 and PROH:B:2. */
export type SubscriptionProhibitionId = 'PROH:B:1' | 'PROH:B:2';

/**
 * PROH:B:1 and PROH:B:2 are transitions that do not exist. Under core rule 1,
 * an attempted transition is refused, recorded, and marked for reconciliation;
 * the mark is not a subscription state and the row keeps its current status.
 */
export const PROHIBITED_SUBSCRIPTION_TRANSITIONS = [
    {
        id: 'PROH:B:1',
        from: 'CANCEL_SCHEDULED',
        to: ['ACTIVE'] satisfies readonly SubscriptionStatus[]
    },
    {
        id: 'PROH:B:2',
        from: 'CANCELLED',
        to: [
            'PENDING_AUTHORIZATION',
            'ABANDONED',
            'ACTIVE',
            'GRACE_PERIOD',
            'PAUSED',
            'SUSPENDED',
            'CANCEL_SCHEDULED',
            'CHARGE_DECLINED'
        ] satisfies readonly SubscriptionStatus[]
    }
] as const;

/** Finds a prohibited source and destination pair, or returns null. */
export function findSubscriptionProhibition(input: {
    readonly from: string;
    readonly to: string;
}): SubscriptionProhibitionId | null {
    const prohibition = PROHIBITED_SUBSCRIPTION_TRANSITIONS.find(
        (candidate) =>
            candidate.from === input.from && (candidate.to as readonly string[]).includes(input.to)
    );
    return prohibition?.id ?? null;
}
