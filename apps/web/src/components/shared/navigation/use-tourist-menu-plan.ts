import { useEffect, useState } from 'react';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import { readTouristCatalog } from '@/lib/billing/gate-plan-names';
import { resolvePaidBenefit, touristBadgeCatalog } from '@/lib/billing/plan-badge';
import { resolveTouristVipBenefitKeys } from '@/lib/billing/tourist-vip-benefits';

interface MenuPlan {
    readonly name: string;
    readonly paid: boolean;
    readonly until: string | null;
    readonly upgrade: string | null;
}

async function readMenuPlan(): Promise<MenuPlan | null> {
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

/** Load the account's tourist plan only while its navigation menu is open. */
export function useTouristMenuPlan({
    account,
    open
}: {
    readonly account?: string;
    readonly open: boolean;
}): MenuPlan | null {
    const [state, setState] = useState<{
        readonly account: string;
        readonly plan: MenuPlan | null;
    } | null>(null);
    useEffect(() => {
        if (!account || !open) return;
        let current = true;
        void readMenuPlan()
            .catch(() => null)
            .then((plan) => {
                if (current) setState({ account, plan });
            });
        return () => {
            current = false;
        };
    }, [account, open]);
    return account && state?.account === account ? state.plan : null;
}
