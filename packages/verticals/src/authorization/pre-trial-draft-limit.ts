/**
 * The pre-trial DRAFT allowance (HOS-1721, DEC-TRIAL-007).
 *
 * A pre-trial owner (no trial row, no live title) folds only the floor and the
 * pre-trial plan, neither of which carries a commercial limit, so every limit
 * read from their effective set is absent and step 7 reads it as `0`. That is
 * the right answer for every limit except the photos: the trial starts at the
 * first publish, the first publish requires a main photo, and so a `0` photo
 * cap on the DRAFT blocks the whole new-host funnel.
 *
 * For the keys in {@link PRE_TRIAL_DRAFT_LIMIT_KEYS_BY_VERTICAL}, and only on a DRAFT, the
 * cap is the value the trial WILL grant once it starts: the same derivation
 * `evaluateTrialStart` stores as the trial's floor (limits from the
 * lowest-rank sellable current version, overridden by the trial plan's current
 * version), resolved through {@link resolveTrialValues}. A draft therefore
 * never holds more photos than its first publish allows. Every other limit key
 * keeps the `?? 0` reading of step 7.
 */
import type { BillingForVerticals, CoverageResponse } from '@repo/billing-verticals-contract';
import { VerticalEnum } from '@repo/schemas';
import { resolveTrialValues } from '../effective-set/trial-ratchet';
import type { PlanCatalogReader } from '../plan-catalog/catalog-reader';
import type { TrialStartReader } from '../trial/trial-start-types';

/**
 * The limit keys a pre-trial owner may use on a DRAFT, at the trial's cap, per
 * vertical. Gastronomy and experience declare no photo limit on their media
 * routes, so they have nothing to allow.
 */
export const PRE_TRIAL_DRAFT_LIMIT_KEYS_BY_VERTICAL: Readonly<
    Partial<Record<VerticalEnum, readonly string[]>>
> = {
    [VerticalEnum.ACCOMMODATION]: ['max_photos_per_accommodation']
};

/**
 * Port that answers the pre-trial DRAFT caps of one account and vertical: an
 * empty map when the account is not pre-trial, or the vertical grants no trial.
 */
export type PreTrialDraftLimitsPort = (args: {
    readonly userId: string;
    readonly vertical: VerticalEnum;
}) => Promise<ReadonlyMap<string, number>>;

/**
 * Whether `key` is a limit a pre-trial owner may use on a DRAFT of `vertical`.
 *
 * @param input.vertical - The listing vertical.
 * @param input.key - The limit key step 7 checks.
 * @returns `true` for a key in {@link PRE_TRIAL_DRAFT_LIMIT_KEYS_BY_VERTICAL}.
 */
export function isPreTrialDraftLimitKey({
    vertical,
    key
}: {
    readonly vertical: VerticalEnum;
    readonly key: string;
}): boolean {
    return PRE_TRIAL_DRAFT_LIMIT_KEYS_BY_VERTICAL[vertical]?.includes(key) ?? false;
}

/**
 * Whether a coverage answer describes a pre-trial account: no live title, and
 * a TRIAL source whose clock has not started (no trial row yet). An account
 * whose trial ran out has no such source and is NOT pre-trial.
 *
 * @param input.coverage - The coverage of one account and vertical.
 * @returns `true` only for the pre-trial state.
 */
export function isPreTrialCoverage({ coverage }: { readonly coverage: CoverageResponse }): boolean {
    return (
        !coverage.covered &&
        coverage.sources.some((source) => source.type === 'TRIAL' && source.since === 'NOT_STARTED')
    );
}

/**
 * Resolves the pre-trial DRAFT caps of one account and vertical.
 *
 * @param input.billing - Billing's coverage query.
 * @param input.reader - Reads the plan catalog.
 * @param input.trialPlans - Reads the vertical's trial plan and its current version.
 * @param input.userId - The listing owner.
 * @param input.vertical - The listing vertical.
 * @returns The caps of the vertical's keys in
 * {@link PRE_TRIAL_DRAFT_LIMIT_KEYS_BY_VERTICAL} the trial will grant; empty
 * when the vertical has no such key, the account is not pre-trial, the
 * vertical has no trial plan, its trial grants no days, or nothing is sellable.
 */
export async function resolvePreTrialDraftLimits(input: {
    readonly billing: Pick<BillingForVerticals, 'coverage'>;
    readonly reader: PlanCatalogReader;
    readonly trialPlans: Pick<TrialStartReader, 'findTrialPlan'>;
    readonly userId: string;
    readonly vertical: VerticalEnum;
}): Promise<ReadonlyMap<string, number>> {
    const none = new Map<string, number>();
    if (!PRE_TRIAL_DRAFT_LIMIT_KEYS_BY_VERTICAL[input.vertical]) return none;
    const coverage = await input.billing.coverage({
        userId: input.userId,
        vertical: input.vertical
    });
    if (!isPreTrialCoverage({ coverage })) return none;
    const trialPlan = await input.trialPlans.findTrialPlan({ vertical: input.vertical });
    if (!trialPlan || trialPlan.trialDays <= 0) return none;
    const versions = await input.reader.findSellableCurrentVersions({ vertical: input.vertical });
    const lowest = versions[0];
    const highest = versions[versions.length - 1];
    if (!lowest || !highest) return none;
    // The floor `evaluateTrialStart` would store if the trial started now.
    const grants = await resolveTrialValues({
        reader: input.reader,
        trial: {
            userId: input.userId,
            vertical: input.vertical,
            trialPlanId: trialPlan.planId,
            floor: {
                entitlementsVersionId: highest.id,
                limitsVersionId: lowest.id,
                trialPlanVersionId: trialPlan.planVersionId
            }
        }
    });
    const limits = new Map<string, number>();
    for (const grant of grants)
        if (isPreTrialDraftLimitKey({ vertical: input.vertical, key: grant.key }))
            limits.set(grant.key, grant.value);
    return limits;
}
