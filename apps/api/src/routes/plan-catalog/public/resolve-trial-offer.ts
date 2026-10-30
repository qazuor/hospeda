import {
    type PublicPlanCatalogTrialOffer,
    type PublicPlanCatalogVertical,
    resolveVerticalTrialPath
} from '@repo/schemas';

/**
 * Decides whether a vertical's public pricing may promise a free trial, and for
 * how many days (HOS-1967). This is the ONLY place that decision is made; the
 * web renders what it returns and never infers a trial on its own.
 *
 * A trial is offered when, and only when, both hold:
 * - the vertical has a real trial path (its activation event has a producer —
 *   see `resolveVerticalTrialPath`). Tourist declares an event nothing
 *   produces, so it is never offered a trial, whatever its catalog says;
 * - its `role='trial'` plan has a current version with `trial_days > 0`. That
 *   version is the single source of the trial length: it is what the trial
 *   engine reads when the trial starts.
 *
 * @param input - RO-RO input.
 * @param input.vertical - The public catalog vertical.
 * @param input.trialPlanTrialDays - `trial_days` of the vertical's trial plan's
 *   current version, or `null` when the vertical has no trial plan or no current
 *   version.
 * @returns `{ trialOffer }` — the offer, or `null` when none may be promised.
 */
export function resolveTrialOffer(input: {
    readonly vertical: PublicPlanCatalogVertical;
    readonly trialPlanTrialDays: number | null;
}): { readonly trialOffer: PublicPlanCatalogTrialOffer | null } {
    const { hasTrialPath } = resolveVerticalTrialPath({ vertical: input.vertical });
    const days = input.trialPlanTrialDays;
    if (!hasTrialPath || days === null || !Number.isInteger(days) || days <= 0) {
        return { trialOffer: null };
    }
    return { trialOffer: { trialDays: days } };
}
