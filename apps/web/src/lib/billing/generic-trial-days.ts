/**
 * @file billing/generic-trial-days.ts
 * @description Resolves the "generic" owner trial length shown on marketing
 * surfaces that promise a trial BEFORE the visitor has picked a specific plan
 * (the FAQ, the `/funcionalidades` hero, the `/publicar` callout, the plan
 * comparison CTA, the new-property form, the property list's
 * "necesitás un plan" message). Those surfaces used to hardcode
 * `OWNER_TRIAL_DAYS` from `@repo/billing/constants`, which is independent of
 * `billing_plans.metadata.trialDays` in the database — the number the
 * checkout actually grants. If the owner changes a plan's trial length, the
 * constant silently goes stale and the web keeps promising the old number
 * (H-98).
 *
 * ## Why the MINIMUM across owner plans, not the maximum or an arbitrary one
 *
 * There are three active owner plans (`owner-basico`, `owner-pro`,
 * `owner-premium`), each with its own `trialDays`. A generic, pre-selection
 * promise can only ever be as good as the WORST plan a visitor might end up
 * choosing: promising the longest trial and then handing a shorter one to
 * whoever picks the cheapest plan is the exact class of bug this fix removes.
 * The minimum is therefore the only value that is never false for anyone.
 * Once the plans genuinely diverge, per-plan surfaces (e.g.
 * `PricingCardsGrid.astro`, which already reads `plan.trialDays` per card)
 * remain the accurate source for a plan-specific promise — this helper is
 * only for copy that has to name ONE number before the visitor has chosen.
 *
 * ## Three entry points
 *
 * - {@link computeMinimumTrialDays} is the AUDIENCE-AGNOSTIC core: given any
 *   already-selected plan list, returns the minimum `trialDays` among the
 *   active plans that actually offer a trial, or `null` when none do. It is
 *   what the plan index calls once per audience (see
 *   `billing/audience-plans.ts`), so tourist, gastronomy, experience and
 *   partner get the same rule the owner tier has had since H-98 instead of a
 *   second, subtly different copy of it.
 * - {@link computeGenericOwnerTrialDays} is that core narrowed to the owner
 *   category — the shape the pre-selection owner surfaces need. Callers that
 *   already fetched plans for another reason on the same page (e.g. the plan
 *   comparison table) should call this directly instead of fetching again.
 * - {@link resolveGenericOwnerTrialDays} is the convenience wrapper for
 *   callers with no existing plan fetch: it calls `fetchPublicPlans()` itself
 *   and falls back to `OWNER_TRIAL_DAYS` when the fetch fails or no plan
 *   qualifies.
 *
 * Both are SSR-only (they end up importing `@repo/billing`), so they must
 * only be called from `.astro` frontmatter — never from a client island. See
 * `apps/web/test/static-guards/billing-barrel-client-isolation.test.ts`.
 */

import { OWNER_TRIAL_DAYS } from '@repo/billing';
import {
    fetchPublicPlans,
    filterPlansByCategory,
    type PublicPlanData
} from '@/lib/billing/fetch-plans';

/** Input for {@link computeMinimumTrialDays}. */
export interface ComputeMinimumTrialDaysParams {
    /**
     * The plans that make up ONE audience's offer, already selected by the
     * caller. May contain inactive plans — they are dropped here — but must not
     * contain plans belonging to another audience, because this function has no
     * way to tell them apart.
     */
    readonly plans: readonly PublicPlanData[];
}

/**
 * The trial length one audience can be promised, from its own plan list.
 *
 * Keeps only plans that are ACTIVE and genuinely offer a trial (`hasTrial`
 * **and** `trialDays > 0`), then returns the minimum among them. Three
 * consequences, and each is the behaviour the callers depend on:
 *
 * - A plan with no trial does NOT drag the promise to zero — it is not a
 *   candidate at all. That is what lets the tourist card advertise the paid
 *   tier's trial without `tourist-free` (which has no trial because it never
 *   expires) silently zeroing it.
 * - An audience where NOTHING offers a trial returns `null`, never `0`. The
 *   partner tiers are exactly this case, and `null` is what tells a caller to
 *   render no trial line rather than "0 days".
 * - The minimum, never the maximum: a pre-selection promise can only be as
 *   good as the worst plan the visitor might end up on. Promising the longest
 *   trial and then handing over a shorter one is the H-98 bug itself.
 *
 * @param params - RO-RO input, see {@link ComputeMinimumTrialDaysParams}.
 * @returns The minimum `trialDays` among eligible plans, or `null` when none.
 */
export function computeMinimumTrialDays({ plans }: ComputeMinimumTrialDaysParams): number | null {
    const eligiblePlans = plans.filter(
        (plan) => plan.isActive && plan.hasTrial && plan.trialDays > 0
    );

    if (eligiblePlans.length === 0) {
        return null;
    }

    return Math.min(...eligiblePlans.map((plan) => plan.trialDays));
}

/** Input for {@link computeGenericOwnerTrialDays}. */
export interface ComputeGenericOwnerTrialDaysParams {
    /** Full plan list, as returned by `fetchPublicPlans()` (any category). */
    readonly plans: readonly PublicPlanData[];
}

/**
 * Computes the generic owner trial length from an already-fetched plan list.
 *
 * A thin narrowing of {@link computeMinimumTrialDays} to the active
 * `owner`-category plans (never `complex` — the generic promise is specifically
 * about the anfitrión tier). Returns `null` when no owner plan currently
 * qualifies, so the caller can decide the fallback.
 *
 * @param params - RO-RO input, see {@link ComputeGenericOwnerTrialDaysParams}.
 * @returns The minimum `trialDays` among eligible owner plans, or `null`.
 */
export function computeGenericOwnerTrialDays({
    plans
}: ComputeGenericOwnerTrialDaysParams): number | null {
    return computeMinimumTrialDays({ plans: filterPlansByCategory(plans, 'owner') });
}

/**
 * Fetches the live billing plans and resolves the generic owner trial length,
 * falling back to the `OWNER_TRIAL_DAYS` constant when the fetch fails or no
 * active owner plan currently offers a trial.
 *
 * Use this in pages that have no other reason to fetch plans. A page that
 * already calls `fetchPublicPlans()` for another purpose (e.g. to render the
 * plan comparison table) should call {@link computeGenericOwnerTrialDays}
 * directly on its own result instead, to avoid a redundant request.
 *
 * @returns The resolved generic trial length in days. Never throws.
 */
export async function resolveGenericOwnerTrialDays(): Promise<number> {
    const result = await fetchPublicPlans();

    if (!result.ok) {
        return OWNER_TRIAL_DAYS;
    }

    return computeGenericOwnerTrialDays({ plans: result.plans }) ?? OWNER_TRIAL_DAYS;
}
