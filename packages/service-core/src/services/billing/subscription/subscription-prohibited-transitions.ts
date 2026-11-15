import type { SUBSCRIPTION_STATUSES } from '@repo/db';

/** A subscription status known to the database schema. */
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Catalog identifiers for PROH:B:1, PROH:B:2 and PROH:B:4. */
export type SubscriptionProhibitionId = 'PROH:B:1' | 'PROH:B:2' | 'PROH:B:4';

/** Declared exceptions to PROH:B:4, each restricted to its own destination. */
export type SubscriptionProhibitionException =
    | 'S6_CHARGEBACK_ON_COURTESY'
    | 'S22_UNCONSUMED_CREDIT';

/**
 * PROH:B:1, PROH:B:2 and PROH:B:4 are transitions that do not exist. Under core rule 1,
 * an attempted transition is refused, recorded, and marked for reconciliation;
 * the mark is not a subscription state and the row keeps its current status.
 * PROH:B:4 permits PAUSED to SUSPENDED only for S6's courtesy chargeback
 * (owner 2026-09-25, pending 8), and PAUSED to CANCEL_SCHEDULED only for
 * S22's unconsumed successor credit (V2-b, 2026-09-27).
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
    },
    {
        id: 'PROH:B:4',
        from: 'PAUSED',
        to: [
            'PENDING_AUTHORIZATION',
            'ABANDONED',
            'GRACE_PERIOD',
            'SUSPENDED',
            'CANCEL_SCHEDULED',
            'CHARGE_DECLINED'
        ] satisfies readonly SubscriptionStatus[]
    }
] as const;

/** Finds a prohibited pair, respecting only its declared PROH:B:4 exception. */
export function findSubscriptionProhibition(input: {
    readonly from: string;
    readonly to: string;
    readonly exception?: SubscriptionProhibitionException;
}): SubscriptionProhibitionId | null {
    if (
        input.from === 'PAUSED' &&
        ((input.to === 'SUSPENDED' && input.exception === 'S6_CHARGEBACK_ON_COURTESY') ||
            (input.to === 'CANCEL_SCHEDULED' && input.exception === 'S22_UNCONSUMED_CREDIT'))
    )
        return null;
    const prohibition = PROHIBITED_SUBSCRIPTION_TRANSITIONS.find(
        (candidate) =>
            candidate.from === input.from && (candidate.to as readonly string[]).includes(input.to)
    );
    return prohibition?.id ?? null;
}
