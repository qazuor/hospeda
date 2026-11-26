import { LimitKeyEnum } from '@repo/schemas';
import { useEffect, useState } from 'react';
import { fetchPublicPlans } from '@/lib/billing/fetch-plans';
import { touristBadgeCatalog } from '@/lib/billing/plan-badge';
import { resolveTouristVipBenefitKeys } from '@/lib/billing/tourist-vip-benefits';

interface ChatPlan {
    readonly viewer: string | null;
    readonly quota: number | undefined;
    readonly name?: string;
}

/** Read the tourist plan on open; a catalog allowance is not a remaining balance. */
export function useListingChatPlan({
    apiUrl,
    enabled,
    viewer
}: {
    readonly apiUrl: string;
    readonly enabled: boolean;
    readonly viewer: string | null;
}): ChatPlan | undefined {
    const [plan, setPlan] = useState<ChatPlan>();
    useEffect(() => {
        if (!enabled) return;
        let active = true;
        async function load() {
            const [result, api] = await Promise.all([
                fetchPublicPlans({ vertical: 'tourist', apiUrl }),
                viewer ? import('@/lib/api/endpoints-protected') : undefined
            ]);
            const { floor, plans } = touristBadgeCatalog({ result });
            const key = LimitKeyEnum.MAX_AI_CHAT_CONSUMER_PER_MONTH;
            let name: string | undefined;
            let quota: number | undefined;
            if (api) {
                const situation = await api.billingSubscriptionApi.pricingSituation({
                    vertical: 'tourist'
                });
                const state = situation.ok ? situation.data : undefined;
                if (state?.situation === 'TOURIST_VIP_INHERITED') {
                    const inherited = resolveTouristVipBenefitKeys({ result })?.plan;
                    name = plans.find((candidate) => candidate.slug === inherited?.slug)?.name;
                    quota = inherited?.limits[key];
                } else if (
                    state?.situation === 'SUBSCRIBED' &&
                    ['ACTIVE', 'GRACE_PERIOD', 'CANCEL_SCHEDULED'].includes(state.status)
                ) {
                    const mine = await api.billingSubscriptionApi.listMine({});
                    const row = mine.ok
                        ? mine.data.subscriptions.find(
                              (sub) => sub.vertical === 'tourist' && sub.status === state.status
                          )
                        : undefined;
                    const paid = plans.find((candidate) => candidate.slug === row?.plan.slug);
                    name = paid?.name;
                    quota = paid?.limits[key];
                } else {
                    // A grant can change the effective allowance without a commercial plan.
                    const effective = await api.effectiveSetApi.get({ vertical: 'tourist' });
                    quota = effective.ok ? effective.data.limits[key] : undefined;
                }
            } else {
                quota = floor?.limits[key];
            }
            if (active)
                setPlan({
                    viewer,
                    name,
                    quota: quota && Number.isFinite(quota) && quota > 0 ? quota : undefined
                });
        }
        void load().catch(() => {
            if (active) setPlan(undefined);
        });
        return () => {
            active = false;
        };
    }, [apiUrl, enabled, viewer]);
    return plan?.viewer === viewer ? plan : undefined;
}
