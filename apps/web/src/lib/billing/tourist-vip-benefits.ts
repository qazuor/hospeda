import { type FetchPlansResult, fetchPublicPlans } from '@/lib/billing/fetch-plans';

/** Catalog-derived entitlement and limit keys that make up Tourist VIP. */
export interface TouristVipBenefitKeys {
    readonly entitlements: ReadonlySet<string>;
    readonly limits: ReadonlySet<string>;
}

/** Resolve the VIP key sets from purchasable tourist catalog plans only. */
export function resolveTouristVipBenefitKeys({
    result
}: {
    readonly result: FetchPlansResult;
}): TouristVipBenefitKeys | null {
    if (!result.ok) return null;
    const sellablePlans = result.plans.filter((plan) => plan.billingOptions !== undefined);
    if (sellablePlans.length === 0) return null;

    return {
        entitlements: new Set(sellablePlans.flatMap((plan) => plan.entitlements)),
        limits: new Set(sellablePlans.flatMap((plan) => Object.keys(plan.limits)))
    };
}

/** Read Tourist VIP benefit keys for SSR pricing pages. */
export async function fetchTouristVipBenefitKeys(): Promise<TouristVipBenefitKeys | null> {
    return resolveTouristVipBenefitKeys({
        result: await fetchPublicPlans({ vertical: 'tourist' })
    });
}
