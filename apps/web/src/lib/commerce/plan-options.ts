/**
 * @file plan-options.ts
 * @description Narrow, serializable plan shape for the commerce tier picker
 * (HOS-1119), plus the pure entitlement-diff derivation that drives "what
 * does this tier add over the previous one".
 *
 * `CommercePlanOption` is deliberately NOT `PublicPlanData` (from
 * `lib/billing/fetch-plans.ts`) even though it is always derived from it: the
 * picker and the plan-change flow are `.client.tsx` islands, and
 * `apps/web/test/static-guards/billing-barrel-client-isolation.test.ts` bars
 * client entrypoints from reaching `@repo/billing` (directly or transitively).
 * `PublicPlanData` itself is fine as a type-only import (`PlanPicker.client.tsx`
 * already does that for the accommodation flow), but this module keeps the
 * commerce islands one step further removed: they only ever see the handful
 * of plain fields they actually render, mapped once in the `.astro` page via
 * {@link toCommercePlanOption}.
 *
 * @module lib/commerce/plan-options
 */

import type { PublicPlanData } from '@/lib/billing/fetch-plans';

/**
 * One sellable commerce tier, reduced to exactly what the picker UI needs.
 * Every field is a plain primitive or a readonly array of strings — safe to
 * serialize into an Astro island prop.
 */
export interface CommercePlanOption {
    /** Stable tier identifier — what the checkout/change-plan APIs accept. */
    readonly slug: string;
    /** Display name (e.g. "Gastronomía Profesional"). */
    readonly name: string;
    /** Monthly price in ARS centavos. */
    readonly monthlyPriceArs: number;
    /** Entitlement keys this tier grants (as plain strings). */
    readonly entitlements: readonly string[];
    /** Catalogue ordering — lower is cheaper/earlier. */
    readonly sortOrder: number;
}

/**
 * Reduce a full `PublicPlanData` row to the narrow {@link CommercePlanOption}
 * shape. Called from `.astro` pages (SSR), never from a client island.
 *
 * @param plan - The public plan row, as returned by `fetchPublicPlans`.
 * @returns The narrow, serializable projection.
 */
export function toCommercePlanOption(plan: PublicPlanData): CommercePlanOption {
    return {
        slug: plan.slug,
        name: plan.name,
        monthlyPriceArs: plan.monthlyPriceArs,
        entitlements: plan.entitlements,
        sortOrder: plan.sortOrder
    };
}

/** One tier plus what it adds over every cheaper tier already accounted for. */
export interface CommercePlanTierDiff {
    /** The tier itself. */
    readonly plan: CommercePlanOption;
    /**
     * Entitlement keys this tier carries that no CHEAPER tier in the same
     * list already carries. Empty for the cheapest tier — there is no
     * "previous" tier for it to add anything over, so its own entitlements
     * are the baseline everything else is compared against, not something to
     * list as an "addition".
     */
    readonly addedEntitlements: readonly string[];
}

/**
 * Derive, for each plan in a vertical's tier list, which entitlements it adds
 * relative to every cheaper tier already seen (cumulative — not just the
 * immediately-previous tier, so a 3-tier ladder never re-lists an entitlement
 * the base tier already grants).
 *
 * Pure and order-independent on input: the list is sorted by `sortOrder`
 * ascending before diffing, regardless of the order it arrives in.
 *
 * @param plans - The vertical's active tiers (any order).
 * @returns One diff entry per plan, sorted cheapest-first.
 */
export function deriveCommercePlanTierDiffs(
    plans: readonly CommercePlanOption[]
): readonly CommercePlanTierDiff[] {
    const sorted = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);
    const seen = new Set<string>();

    return sorted.map((plan, index) => {
        const addedEntitlements =
            index === 0 ? [] : plan.entitlements.filter((key) => !seen.has(key));
        for (const key of plan.entitlements) {
            seen.add(key);
        }
        return { plan, addedEntitlements };
    });
}
