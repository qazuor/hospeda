/**
 * The general dashboard's numbers (HOS-2473): favorites, reviews and plan.
 *
 * Each StatCard settles on its own, so one failed read shows «—» plus retry on
 * that card and leaves the others alone (HOS-2424: never a fabricated `0`).
 * Per-user data lives here, in a client island, so the page stays free of
 * session reads beyond its auth gate.
 *
 * @module components/account/dashboard/GeneralDashboardStats
 */

import { CreditCardIcon, FavoriteIcon, StarIcon } from '@repo/icons';
import type { UserStatsResponse } from '@repo/schemas';
import { useCallback, useEffect, useState } from 'react';
import {
    type AsyncResult,
    StatCard,
    StatGrid,
    type StatValue,
    settleAsync
} from '@/components/account/ui';
import { resolveDashboardNextStep } from '@/lib/account/dashboard-next-step';
import { userApi } from '@/lib/api/endpoints-protected';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { resolvePlanStat } from './plan-stat';

/** Props of {@link GeneralDashboardStats}. */
export interface GeneralDashboardStatsProps {
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** Translated plan names by catalog slug, read on the server. */
    readonly planNames: Readonly<Record<string, string>>;
}

/** Unwraps an API result, turning a refusal into a rejection `settleAsync` reports as error. */
async function unwrap<T>(
    promise: Promise<{ readonly ok: true; readonly data: T } | { readonly ok: false }>
): Promise<T> {
    const result = await promise;
    if (!result.ok) throw new Error('request failed');
    return result.data;
}

const LOADING = { status: 'loading' } as const;

/**
 * StatGrid of the general dashboard.
 *
 * @param props - See {@link GeneralDashboardStatsProps}.
 * @returns The grid with its three cards.
 */
export function GeneralDashboardStats({ locale, planNames }: GeneralDashboardStatsProps) {
    const t = createT(locale);
    const [statsState, setStatsState] = useState<AsyncResult<UserStatsResponse>>(LOADING);
    const [reviewsState, setReviewsState] = useState<AsyncResult<number>>(LOADING);
    const [planState, setPlanState] = useState<AsyncResult<StatValue>>(LOADING);
    const [planViewAll, setPlanViewAll] = useState(false);

    const loadStats = useCallback(async () => {
        setStatsState(LOADING);
        setPlanState(LOADING);
        const retry = () => void loadStats();
        const stats = await settleAsync({ load: () => unwrap(userApi.getStats()), retry });
        setStatsState(stats);
        if (stats.status !== 'ready') {
            setPlanState({ status: 'error', retry });
            return;
        }
        const plan = await resolvePlanStat({ stats: stats.data, planNames, locale, t });
        setPlanViewAll(plan.viewAll);
        setPlanState({ status: 'ready', data: plan.stat });
    }, [planNames, locale, t]);

    const loadReviews = useCallback(async () => {
        setReviewsState(LOADING);
        setReviewsState(
            await settleAsync({
                load: async () => (await unwrap(userApi.getReviews({ pageSize: 1 }))).totals.total,
                retry: () => void loadReviews()
            })
        );
    }, []);

    // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount; the loaders are their own retries
    useEffect(() => {
        void loadStats();
        void loadReviews();
    }, []);

    const favoritesState: AsyncResult<StatValue> =
        statsState.status === 'ready'
            ? {
                  status: 'ready',
                  data: {
                      value: statsState.data.bookmarkCount,
                      nextStep: resolveDashboardNextStep({
                          kind: 'favorites',
                          count: statsState.data.bookmarkCount,
                          locale
                      })
                  }
              }
            : statsState;
    const reviewsValue: AsyncResult<StatValue> =
        reviewsState.status === 'ready'
            ? {
                  status: 'ready',
                  data: {
                      value: reviewsState.data,
                      nextStep: resolveDashboardNextStep({
                          kind: 'reviews',
                          count: reviewsState.data,
                          locale
                      })
                  }
              }
            : reviewsState;

    return (
        <StatGrid helpId="section:account.dashboard">
            <StatCard
                id="favorites"
                label={t('account.pages.dashboard.stats.favorites')}
                state={favoritesState}
                locale={locale}
                icon={<FavoriteIcon size={20} />}
                link={{
                    href: buildUrl({ locale, path: 'mi-cuenta/favoritos' }),
                    label: t('account.pages.dashboard.stats.viewFavorites')
                }}
            />
            <StatCard
                id="reviews"
                label={t('account.pages.dashboard.stats.reviews')}
                state={reviewsValue}
                locale={locale}
                icon={<StarIcon size={20} />}
                link={{
                    href: buildUrl({ locale, path: 'mi-cuenta/resenas' }),
                    label: t('account.pages.dashboard.stats.viewReviews')
                }}
            />
            <StatCard
                id="subscription"
                label={t('account.pages.dashboard.stats.subscription')}
                state={planState}
                locale={locale}
                icon={<CreditCardIcon size={20} />}
                link={{
                    href: buildUrl({ locale, path: 'mi-cuenta/suscripcion' }),
                    label: t(
                        planViewAll
                            ? 'account.pages.dashboard.stats.viewAllSubscriptions'
                            : 'account.pages.dashboard.stats.viewSubscription'
                    )
                }}
            />
        </StatGrid>
    );
}
