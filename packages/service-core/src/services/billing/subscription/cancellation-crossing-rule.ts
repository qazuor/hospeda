import type { DomainEventChange } from '@repo/db';

/** Transitions whose cancellation can receive a charge that crossed the cancellation. */
export const CROSSING_MARK_TRANSITIONS_ON_CANCELLED = ['S11', 'S23', 'S24'] as const;

/** A Free Forever closed the row: B/05 §3 tie-break, second row (LOCK:C3). */
export const GRANT_CROSSING_TRANSITIONS = ['S13', 'S20'] as const;

export type CrossingMarkTransition = 'S11' | 'S23' | 'S24' | 'S13' | 'S20';

/** B/05 §3 tie-break: the reason names why the cancelled row cannot receive a charge. */
export function crossingMarkReason(input: {
    readonly transition: CrossingMarkTransition;
}): 'COBRO_POSTERIOR_A_LA_BAJA' | 'COBRO_POSTERIOR_AL_GRANT' {
    const reasons: Record<
        CrossingMarkTransition,
        'COBRO_POSTERIOR_A_LA_BAJA' | 'COBRO_POSTERIOR_AL_GRANT'
    > = {
        S11: 'COBRO_POSTERIOR_A_LA_BAJA',
        S23: 'COBRO_POSTERIOR_A_LA_BAJA',
        S24: 'COBRO_POSTERIOR_A_LA_BAJA',
        S13: 'COBRO_POSTERIOR_AL_GRANT',
        S20: 'COBRO_POSTERIOR_AL_GRANT'
    };
    return reasons[input.transition];
}

/** Action for a credited payment relative to its subscription cancellation. */
export type CrossingAction = 'EXTEND' | 'MARK' | 'NONE';

/** Classifies C2/C3 against the cancellation decision; arrival time has no bearing. */
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
                ((CROSSING_MARK_TRANSITIONS_ON_CANCELLED as readonly string[]).includes(
                    input.decision.transition
                ) ||
                    (GRANT_CROSSING_TRANSITIONS as readonly string[]).includes(
                        input.decision.transition
                    ))
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

/** Builds the ordered audit detail carried by C2/C3's reconciliation mark event. */
export function crossingMarkDetail(input: {
    readonly chargeId: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly factAt: Date;
    readonly transition: CrossingMarkTransition;
    readonly graceStartedAt: Date | null;
}): readonly DomainEventChange[] {
    const changes: DomainEventChange[] = [
        { field: 'provider.charge_id', new: input.chargeId },
        { field: 'provider.charge_amount_minor', new: input.amountMinor },
        { field: 'provider.charge_currency', new: input.currency },
        { field: 'payment.fact_at', new: input.factAt.toISOString() },
        { field: 'subscription.cancellation_transition', new: input.transition }
    ];
    const includeGrace: Record<CrossingMarkTransition, boolean> = {
        S11: false,
        S23: false,
        S24: true,
        S13: false,
        S20: false
    };
    if (includeGrace[input.transition] && input.graceStartedAt)
        changes.push({
            field: 'subscription.grace_started_at',
            new: input.graceStartedAt.toISOString()
        });
    return changes;
}
