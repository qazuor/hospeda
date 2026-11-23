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
import type { TrialSummaryResponse, UserStatsResponse } from '@repo/schemas';
import { useCallback, useEffect, useState } from 'react';
import {
    type AsyncResult,
    StatCard,
    StatGrid,
    type StatValue,
    settleAsync
} from '@/components/account/ui';
import { resolveSubscriptionStatText } from '@/lib/account/general-dashboard';
import { publishApi, userApi } from '@/lib/api/endpoints-protected';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { formatNoticeInstant } from '@/lib/listing/listing-notices';
import { buildUrl } from '@/lib/urls';
import styles from './Dashboard.module.css';

/** Props of {@link GeneralDashboardStats}. */
export interface GeneralDashboardStatsProps {
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** Translated plan names by catalog slug, read on the server. */
    readonly planNames: Readonly<Record<string, string>>;
}

/** A trial read that takes longer than this is left out (the card keeps the free label). */
const TRIAL_READ_TIMEOUT_MS = 3000;

/** Reads every vertical's trial; a failure or timeout leaves that vertical out. Never rejects. */
async function readTrialSummaries(): Promise<readonly TrialSummaryResponse[]> {
    const reads = await Promise.all(
        (['accommodation', 'venue', 'experience'] as const).map(async (vertical) => {
            try {
                const result = await Promise.race([
                    publishApi.trialSummary({ vertical }),
                    new Promise<null>((resolve) => {
                        setTimeout(() => resolve(null), TRIAL_READ_TIMEOUT_MS);
                    })
                ]);
                return result?.ok ? [result.data] : [];
            } catch {
                return [];
            }
        })
    );
    return reads.flat();
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
        const needsTrial =
            stats.data.plan === null &&
            stats.data.activeSubscriptionsCount < 2 &&
            (stats.data.subscriptions?.length ?? 0) < 2;
        const trialSummaries = needsTrial ? await readTrialSummaries() : [];
        const text = resolveSubscriptionStatText({
            stats: stats.data,
            planNames,
            trialSummaries,
            t,
            formatDate: (iso) => formatNoticeInstant({ iso, locale })
        });
        // HOS-2553: the subscription rows and the what-to-do line ride in the hint.
        const hasDetail = text.rows.length > 0 || text.action !== null;
        setPlanViewAll(text.viewAll);
        setPlanState({
            status: 'ready',
            data: {
                value: text.value,
                hint: hasDetail ? (
                    <>
                        {text.hint ? <span className={styles.subRow}>{text.hint}</span> : null}
                        {text.rows.map((row) => (
                            <span
                                key={`${row.plan}:${row.status}`}
                                className={styles.subRow}
                                data-testid="subscription-row"
                            >
                                <span className={styles.subPlan}>{row.plan}</span> · {row.status}
                            </span>
                        ))}
                        {text.action ? (
                            <span
                                className={styles.subAction}
                                data-testid="subscription-action"
                            >
                                {text.action}
                            </span>
                        ) : null}
                    </>
                ) : (
                    (text.hint ?? undefined)
                )
            }
        });
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
            ? { status: 'ready', data: { value: statsState.data.bookmarkCount } }
            : statsState;
    const reviewsValue: AsyncResult<StatValue> =
        reviewsState.status === 'ready'
            ? { status: 'ready', data: { value: reviewsState.data } }
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
