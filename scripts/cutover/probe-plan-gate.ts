import type { CutoverFailure, ProviderObject } from './types.ts';

/**
 * Finds preserved live probes attached to plans that step 1a will cancel.
 *
 * @param input - reread preapprovals, preserved probe ids and plan cancellation ids
 * @returns one safe failure per bound probe, in preapproval traversal order
 */
export function findProbePlanBindings({
    preapprovals,
    probeIds,
    plansToCancel
}: {
    readonly preapprovals: readonly ProviderObject[];
    readonly probeIds: ReadonlySet<string>;
    readonly plansToCancel: readonly string[];
}): readonly CutoverFailure[] {
    const planIds = new Set(plansToCancel);
    return preapprovals
        .filter(
            ({ id, status, planId }) =>
                probeIds.has(id) &&
                status !== 'cancelled' &&
                planId !== null &&
                planId !== undefined &&
                planIds.has(planId)
        )
        .map(({ id, planId }) => ({
            code: 'PROBE_PLAN_BOUND',
            id,
            detail: `preserved probe is attached to plan ${planId}`
        }));
}
