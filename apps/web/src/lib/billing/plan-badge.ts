import type { FetchPlansResult, PublicPlanData } from './fetch-plans';

/** Split the public tourist catalog into its free floor and active sellable tiers. */
export function touristBadgeCatalog({ result }: { readonly result: FetchPlansResult }): {
    readonly floor: PublicPlanData | undefined;
    readonly plans: readonly PublicPlanData[];
} {
    const tourist = result.ok ? result.plans.filter((plan) => plan.vertical === 'tourist') : [];
    return {
        floor: tourist.find((plan) => !plan.billingOptions),
        plans: tourist.filter((plan) => plan.isActive && plan.billingOptions)
    };
}

interface BadgePlan {
    readonly name: string;
    readonly entitlements: readonly string[];
}

/** Resolve the first sellable tourist plan that adds the requested benefit over the floor. */
export function resolvePlanBadge({
    result,
    entitlement
}: {
    readonly result: FetchPlansResult;
    readonly entitlement: string;
}): string | null {
    return resolvePaidBenefit({ ...touristBadgeCatalog({ result }), entitlement });
}

/** Compare the raw or mapped catalog's floor with its sellable plans. */
export function resolvePaidBenefit({
    floor,
    plans,
    entitlement
}: {
    readonly floor?: BadgePlan | null;
    readonly plans: readonly BadgePlan[];
    readonly entitlement: string;
}): string | null {
    if (!floor || floor.entitlements.includes(entitlement)) return null;
    return plans.find((plan) => plan.entitlements.includes(entitlement))?.name ?? null;
}
