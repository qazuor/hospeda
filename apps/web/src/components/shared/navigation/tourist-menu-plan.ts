/**
 * Tourist plan line for the account menus. Loaded on demand (dynamic import)
 * so the early-hydrating menu islands do not pull the protected API client.
 */
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import { readTouristCatalog } from '@/lib/billing/gate-plan-names';
import { resolvePaidBenefit, touristBadgeCatalog } from '@/lib/billing/plan-badge';
import { resolveTouristVipBenefitKeys } from '@/lib/billing/tourist-vip-benefits';

export interface MenuPlan {
    readonly name: string;
    readonly paid: boolean;
    readonly until: string | null;
    readonly upgrade: string | null;
}

/** Read the signed-in account's tourist plan line for the navigation menu. */
export async function readMenuPlan(): Promise<MenuPlan | null> {
    const [result, situation] = await Promise.all([
        readTouristCatalog(),
        billingSubscriptionApi.pricingSituation({ vertical: 'tourist', cookieHeader: undefined })
    ]);
    if (!situation.ok) return null;
    const { floor, plans } = touristBadgeCatalog({ result });
    if (!floor) return null;
    const state = situation.data;
    if (state.situation === 'TOURIST_VIP_INHERITED') {
        const name = resolveTouristVipBenefitKeys({ result })?.badgeName;
        return name ? { name, paid: true, until: null, upgrade: null } : null;
    }
    if (state.situation === 'SUBSCRIBED') {
        if (!['ACTIVE', 'CANCEL_SCHEDULED', 'GRACE_PERIOD'].includes(state.status)) return null;
        const mine = await billingSubscriptionApi.listMine({});
        if (!mine.ok) return null;
        const row = mine.data.subscriptions.find(
            (sub) => sub.vertical === 'tourist' && sub.status === state.status
        );
        const plan = plans.find((entry) => entry.slug === row?.plan.slug);
        if (!plan || !row) return null;
        return {
            name: plan.name,
            paid: true,
            until: row.nextCharge?.at ?? row.serviceEndsAt ?? null,
            upgrade: null
        };
    }
    if (state.situation !== 'CHECKOUT' && state.situation !== 'NO_PLANS') return null;
    const upgrade =
        state.situation === 'CHECKOUT'
            ? (plans.find((plan) =>
                  plan.entitlements.some(
                      (entitlement) =>
                          resolvePaidBenefit({ floor, plans: [plan], entitlement }) !== null
                  )
              )?.name ?? null)
            : null;
    return { name: floor.name, paid: false, until: null, upgrade };
}
