import type { DomainEventChange } from '@repo/db';

/** Transitions whose cancellation can receive a charge that crossed the cancellation. */
export const CROSSING_MARK_TRANSITIONS_ON_CANCELLED = ['S11', 'S23', 'S24'] as const;

/** Action for a credited payment relative to its subscription cancellation. */
export type CrossingAction = 'EXTEND' | 'MARK' | 'NONE';

/** Classifies against the cancellation fact time; arrival time has no bearing on C2. */
export function classifyCancellationCrossing(input: {
    readonly status: string;
    readonly class: string;
    readonly decision: { readonly transition: string; readonly decidedAt: Date } | null;
    readonly factAt: Date;
}): CrossingAction {
    switch (input.status) {
        case 'LAPIDA':
            return 'NONE';
        case 'CANCEL_SCHEDULED':
            if (input.decision?.transition !== 'S11') return 'NONE';
            if (input.factAt < input.decision.decidedAt) return 'EXTEND';
            return 'MARK';
        case 'CANCELLED':
            if (
                input.decision &&
                (CROSSING_MARK_TRANSITIONS_ON_CANCELLED as readonly string[]).includes(
                    input.decision.transition
                )
            )
                return 'MARK';
            return 'NONE';
        case 'ACTIVE':
        case 'GRACE_PERIOD':
        case 'SUSPENDED':
        case 'PAUSED':
        case 'PENDING_AUTHORIZATION':
        default:
            return 'NONE';
    }
}

/** Returns the later service end so a crossing extension never shortens service. */
export function crossingExtensionEnd(input: { readonly current: Date; readonly formula: Date }): {
    readonly serviceEndsAt: Date;
    readonly extended: boolean;
} {
    if (input.formula > input.current) return { serviceEndsAt: input.formula, extended: true };
    return { serviceEndsAt: input.current, extended: false };
}

/** Builds the ordered audit detail carried by C2's reconciliation mark event. */
export function crossingMarkDetail(input: {
    readonly chargeId: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly factAt: Date;
    readonly transition: 'S11' | 'S23' | 'S24';
    readonly graceStartedAt: Date | null;
}): readonly DomainEventChange[] {
    const changes: DomainEventChange[] = [
        { field: 'provider.charge_id', new: input.chargeId },
        { field: 'provider.charge_amount_minor', new: input.amountMinor },
        { field: 'provider.charge_currency', new: input.currency },
        { field: 'payment.fact_at', new: input.factAt.toISOString() },
        { field: 'subscription.cancellation_transition', new: input.transition }
    ];
    const includeGrace: Record<'S11' | 'S23' | 'S24', boolean> = {
        S11: false,
        S23: false,
        S24: true
    };
    if (includeGrace[input.transition] && input.graceStartedAt)
        changes.push({
            field: 'subscription.grace_started_at',
            new: input.graceStartedAt.toISOString()
        });
    return changes;
}
