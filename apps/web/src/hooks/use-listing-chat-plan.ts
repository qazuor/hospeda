import { LimitKeyEnum } from '@repo/schemas';
import { useEffect, useState } from 'react';
import { fetchPublicPlans } from '@/lib/billing/fetch-plans';
import { touristBadgeCatalog } from '@/lib/billing/plan-badge';

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
            const [result, subscriptions] = await Promise.all([
                fetchPublicPlans({ vertical: 'tourist', apiUrl }),
                viewer
                    ? import('@/lib/api/endpoints-protected').then(({ billingSubscriptionApi }) =>
                          billingSubscriptionApi.listMine({})
                      )
                    : undefined
            ]);
            const { floor, plans } = touristBadgeCatalog({ result });
            if (viewer && !subscriptions?.ok) return;
            const slug = subscriptions?.ok
                ? subscriptions.data.subscriptions.find(
                      (row) =>
                          row.vertical === 'tourist' &&
                          ['ACTIVE', 'GRACE_PERIOD', 'CANCEL_SCHEDULED'].includes(row.status)
                  )?.plan.slug
                : undefined;
            const paid = plans.find((candidate) => candidate.slug === slug);
            const quota = (slug ? paid : floor)?.limits[
                LimitKeyEnum.MAX_AI_CHAT_CONSUMER_PER_MONTH
            ];
            if (active)
                setPlan({
                    viewer,
                    name: paid?.name,
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
