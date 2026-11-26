import { type FetchPlansResult, fetchPublicPlans } from '@/lib/billing/fetch-plans';
import {
    resolvePaidBenefit,
    selectInheritedTouristPlan,
    touristBadgeCatalog
} from '@/lib/billing/plan-badge';

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
    /** Catalog name when the inherited tier adds an entitlement above the floor. */
    readonly badgeName?: string | null;
}

/** Resolve the VIP key sets from purchasable tourist catalog plans only. */
export function resolveTouristVipBenefitKeys({
    result
}: {
    readonly result: FetchPlansResult;
}): TouristVipBenefitKeys | null {
    if (!result.ok) return null;
    const { floor, plans: sellablePlans } = touristBadgeCatalog({ result });
    const top = selectInheritedTouristPlan({ sellablePlans });
    if (!top) return null;

    return {
        entitlements: new Set(sellablePlans.flatMap((plan) => plan.entitlements)),
        limits: new Set(sellablePlans.flatMap((plan) => Object.keys(plan.limits))),
        plan: { slug: top.slug, entitlements: top.entitlements, limits: top.limits },
        badgeName: top.entitlements.reduce<string | null>(
            (name, entitlement) =>
                name ?? resolvePaidBenefit({ floor: floor ?? null, plans: [top], entitlement }),
            null
        )
    };
}

/** Read Tourist VIP benefit keys for SSR pricing pages. */
export async function fetchTouristVipBenefitKeys(): Promise<TouristVipBenefitKeys | null> {
    return resolveTouristVipBenefitKeys({
        result: await fetchPublicPlans({ vertical: 'tourist' })
    });
}
