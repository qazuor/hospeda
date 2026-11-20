import { type FetchPlansResult, fetchPublicPlans } from '@/lib/billing/fetch-plans';

/**
 * The sellable Tourist VIP plan's own cells: what an owner plan that inherits
 * Tourist VIP actually receives at runtime (`resolveTouristVipInheritance`).
 *
 * HOS-2398: the owner plans are losing their copy of the tourist entitlements
 * and limits, so any surface that shows the inherited benefits must resolve
 * them against THIS plan, never against the owner plan's own rows.
 */
export interface TouristVipPlanCells {
    readonly slug: string;
    readonly entitlements: readonly string[];
    readonly limits: Readonly<Record<string, number>>;
}

/** Catalog-derived entitlement and limit keys that make up Tourist VIP. */
export interface TouristVipBenefitKeys {
    readonly entitlements: ReadonlySet<string>;
    readonly limits: ReadonlySet<string>;
    /** The top sellable tourist tier, whose values the inherited cells show. */
    readonly plan: TouristVipPlanCells;
}

/** Resolve the VIP key sets from purchasable tourist catalog plans only. */
export function resolveTouristVipBenefitKeys({
    result
}: {
    readonly result: FetchPlansResult;
}): TouristVipBenefitKeys | null {
    if (!result.ok) return null;
    const sellablePlans = result.plans.filter((plan) => plan.billingOptions !== undefined);
    const [first, ...rest] = sellablePlans;
    if (first === undefined) return null;

    // The catalog sells one tourist tier today (`tourist-vip`). Should it sell
    // more, the inherited offer is the top one, read by `sortOrder`.
    const top = rest.reduce((best, plan) => (plan.sortOrder > best.sortOrder ? plan : best), first);

    return {
        entitlements: new Set(sellablePlans.flatMap((plan) => plan.entitlements)),
        limits: new Set(sellablePlans.flatMap((plan) => Object.keys(plan.limits))),
        plan: { slug: top.slug, entitlements: top.entitlements, limits: top.limits }
    };
}

/** Read Tourist VIP benefit keys for SSR pricing pages. */
export async function fetchTouristVipBenefitKeys(): Promise<TouristVipBenefitKeys | null> {
    return resolveTouristVipBenefitKeys({
        result: await fetchPublicPlans({ vertical: 'tourist' })
    });
}
