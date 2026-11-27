/**
 * The host dashboard's third KPI card, «Plan» (HOS-2664, D13): current plan and
 * ONE next-step line («vence en N días», «te quedan N días de prueba») from the
 * real subscription and trial reads. It settles on its own, so a failed read shows
 * «—» plus retry here and leaves the other cards alone.
 *
 * @module components/account/dashboard/HostPlanStatCard
 */

import { CreditCardIcon } from '@repo/icons';
import { useCallback, useEffect, useState } from 'react';
import { type AsyncResult, StatCard, type StatValue, settleAsync } from '@/components/account/ui';
import { resolveHostPlanDateStep } from '@/lib/account/host-plan-step';
import { billingSubscriptionApi, userApi } from '@/lib/api/endpoints-protected';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { resolvePlanStat } from './plan-stat';

/** Props of {@link HostPlanStatCard}. */
export interface HostPlanStatCardProps {
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** Translated plan names by catalog slug, read on the server. */
    readonly planNames: Readonly<Record<string, string>>;
}

/**
 * «Plan» StatCard of the host dashboard.
 *
 * @param props - See {@link HostPlanStatCardProps}.
 * @returns The card.
 */
export function HostPlanStatCard({ locale, planNames }: HostPlanStatCardProps) {
    const t = createT(locale);
    const [state, setState] = useState<AsyncResult<StatValue>>({ status: 'loading' });
    const [viewAll, setViewAll] = useState(false);

    const load = useCallback(async () => {
        setState({ status: 'loading' });
        const retry = () => void load();
        const stats = await settleAsync({
            load: async () => {
                const result = await userApi.getStats();
                if (!result.ok) throw new Error('request failed');
                return result.data;
            },
            retry
        });
        if (stats.status !== 'ready') {
            setState({ status: 'error', retry });
            return;
        }
        const plan = await resolvePlanStat({ stats: stats.data, planNames, locale, t });
        setViewAll(plan.viewAll);
        // A paid plan: the stats payload carries no dates, so the one next-step line
        // comes from the owner's own subscription rows. A failed read keeps the plan line.
        let nextStep = plan.stat.nextStep;
        if (stats.data.plan !== null || (stats.data.subscriptions?.length ?? 0) > 0) {
            try {
                const mine = await billingSubscriptionApi.listMine({});
                if (mine.ok) {
                    nextStep =
                        resolveHostPlanDateStep({
                            rows: mine.data.subscriptions,
                            locale,
                            now: Date.now()
                        }) ?? nextStep;
                }
            } catch {
                // keep the plan line
            }
        }
        setState({ status: 'ready', data: { ...plan.stat, nextStep } });
    }, [planNames, locale, t]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount; `load` is its own retry
    useEffect(() => {
        void load();
    }, []);

    return (
        <StatCard
            id="hostPlan"
            label={t('host.dashboard.widgets.plan')}
            state={state}
            locale={locale}
            icon={<CreditCardIcon size={20} />}
            link={{
                href: buildUrl({ locale, path: 'mi-cuenta/suscripcion' }),
                label: t(
                    viewAll
                        ? 'account.pages.dashboard.stats.viewAllSubscriptions'
                        : 'account.pages.dashboard.stats.viewSubscription'
                )
            }}
        />
    );
}
