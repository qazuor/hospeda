/**
 * @file AnalyticsSection.client.tsx
 * @description Container component for the host analytics section.
 * Fetches the wired analytics endpoints in parallel, then renders the
 * available widgets or a locked state.
 *
 * Which widgets a host may see is the API's decision: a 403 on the basic
 * views read renders the locked state, and a 403 on the market-comparison read
 * hides the two advanced widgets. The section used to pre-gate on the old
 * billing's entitlements; that read was removed with the old billing client
 * (HOS-1637, AC:B13a:22).
 *
 * @remarks
 * SPEC-207 Fase A: the ViewsWidget now receives a `dailySeries` prop from
 * `GET /views/accommodations/me/daily-series`, rendered as a line chart above
 * the per-property ranked list. The toggle handler re-fetches both the
 * cumulative list AND the daily series together.
 *
 * @example
 * ```astro
 * <AnalyticsSection client:load locale={locale} />
 * ```
 */

import { type JSX, useCallback, useEffect, useState } from 'react';
import { hostAnalyticsApi } from '@/lib/api/endpoints-protected';
import {
    transformAccommodationViews,
    transformFavoritesBreakdown,
    transformInquiryTrend,
    transformMarketComparison,
    transformResponseRate,
    transformViewsDailySeries
} from '@/lib/api/transforms';
import type {
    AccommodationViewsData,
    ApiResult,
    FavoritesBreakdownData,
    HostViewDailySeriesData,
    InquiryTrendData,
    MarketComparisonData,
    ResponseRateData
} from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './AnalyticsSection.module.css';
import { FavoritesWidget } from './FavoritesWidget.client';
import { InquiryTrendWidget } from './InquiryTrendWidget.client';
import { MarketComparisonWidget } from './MarketComparisonWidget.client';
import { ResponseRateWidget } from './ResponseRateWidget.client';
import { ViewsWidget } from './ViewsWidget.client';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** HTTP status the API answers when the host's plan does not grant a read. */
const FORBIDDEN_STATUS = 403;

/**
 * Whether a settled analytics read was refused by the API's authorization
 * (as opposed to failing for any other reason, which surfaces as a widget
 * error).
 */
function isForbidden(result: PromiseSettledResult<ApiResult<unknown>>): boolean {
    return (
        result.status === 'fulfilled' &&
        !result.value.ok &&
        result.value.error.status === FORBIDDEN_STATUS
    );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnalyticsSectionProps {
    readonly locale: SupportedLocale;
}

type SectionState =
    | { readonly status: 'loading' }
    | { readonly status: 'locked' }
    | { readonly status: 'ready'; readonly data: AnalyticsData }
    | { readonly status: 'error'; readonly message: string };

interface AnalyticsData {
    readonly responseRate: ResponseRateData | undefined;
    readonly inquiries: InquiryTrendData | undefined;
    readonly marketComparison: MarketComparisonData | undefined;
    readonly views: AccommodationViewsData | undefined;
    /** Gap-filled daily series for the ViewsWidget line chart (SPEC-207 Fase A). */
    readonly viewsDailySeries: HostViewDailySeriesData | undefined;
    /** Favorites per accommodation (advanced-stats only). */
    readonly favorites: FavoritesBreakdownData | undefined;
    /** Stored names map so window toggle can re-cross without re-listing. */
    readonly accommodationNames: ReadonlyMap<string, string>;
    /** Whether the API granted the advanced reads — gates the market + favorites widgets. */
    readonly hasAdvanced: boolean;
}

interface WidgetErrors {
    readonly responseRate: string | null;
    readonly inquiries: string | null;
    readonly marketComparison: string | null;
    readonly views: string | null;
    readonly favorites: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AnalyticsSection — container that gates analytics behind entitlements and
 * renders the wired analytics widgets with parallel data fetching.
 *
 * @example
 * ```astro
 * <AnalyticsSection client:load locale={locale} />
 * ```
 */
export function AnalyticsSection({ locale }: AnalyticsSectionProps): JSX.Element {
    const { t } = createTranslations(locale);
    const [state, setState] = useState<SectionState>({ status: 'loading' });
    const [errors, setErrors] = useState<WidgetErrors>({
        responseRate: null,
        inquiries: null,
        marketComparison: null,
        views: null,
        favorites: null
    });
    const [viewsWindow, setViewsWindow] = useState<'7d' | '30d'>('30d');

    // ── Fetch analytics data ──────────────────────────────────────────
    // biome-ignore lint/correctness/useExhaustiveDependencies: runs ONCE on mount. `t` is a stable translation function; `viewsWindow` is intentionally read as its initial value here — subsequent window changes are handled by handleViewsWindowChange (which re-fetches ONLY views + daily-series), so this effect must NOT depend on viewsWindow or it would re-fetch the whole section on every toggle.
    const fetchAnalytics = useCallback(async () => {
        setState({ status: 'loading' });
        setErrors({
            responseRate: null,
            inquiries: null,
            marketComparison: null,
            views: null,
            favorites: null
        });

        try {
            // Fetch all wired analytics endpoints in parallel. The API decides
            // which of them this host may read (views + daily-series need basic
            // stats; market comparison and favorites need advanced stats).
            const [
                responseRateResult,
                inquiriesResult,
                marketResult,
                viewsResult,
                namesResult,
                favoritesResult,
                dailySeriesResult
            ] = await Promise.allSettled([
                hostAnalyticsApi.getResponseRate(),
                hostAnalyticsApi.getInquiryTrend({ months: 6 }),
                hostAnalyticsApi.getMarketComparison(),
                hostAnalyticsApi.getViews({ window: viewsWindow }),
                hostAnalyticsApi.listOwnAccommodations(),
                hostAnalyticsApi.getFavoritesBreakdown(),
                hostAnalyticsApi.getViewsDailySeries({ window: viewsWindow })
            ]);

            if (isForbidden(viewsResult)) {
                setState({ status: 'locked' });
                return;
            }

            const hasAdvanced = !isForbidden(marketResult);

            const responseRateData =
                responseRateResult.status === 'fulfilled' && responseRateResult.value.ok
                    ? transformResponseRate({
                          // TYPE-WORKAROUND: apiClient returns a generic payload not inferred to the transform's input shape; the transform reads fields defensively.
                          item: responseRateResult.value.data as unknown as Record<string, unknown>
                      })
                    : undefined;

            const inquiriesData =
                inquiriesResult.status === 'fulfilled' && inquiriesResult.value.ok
                    ? transformInquiryTrend({
                          // TYPE-WORKAROUND: apiClient returns a generic payload not inferred to the transform's input shape; the transform reads fields defensively.
                          item: inquiriesResult.value.data as unknown as Record<string, unknown>
                      })
                    : undefined;

            const marketData =
                hasAdvanced && marketResult.status === 'fulfilled' && marketResult.value.ok
                    ? transformMarketComparison({
                          // TYPE-WORKAROUND: apiClient returns a generic payload not inferred to the transform's input shape; the transform reads fields defensively.
                          item: marketResult.value.data as unknown as Record<string, unknown>
                      })
                    : undefined;

            // Build id→name map from accommodations list (fail-safe: empty map on error)
            const accommodationNames = new Map<string, string>();
            if (namesResult.status === 'fulfilled' && namesResult.value.ok) {
                for (const acc of namesResult.value.data.items) {
                    accommodationNames.set(acc.id, acc.name);
                }
            }

            // Cross views with names map
            const viewsData =
                viewsResult.status === 'fulfilled' && viewsResult.value.ok
                    ? transformAccommodationViews({
                          views: viewsResult.value.data as ReadonlyArray<Record<string, unknown>>,
                          names: accommodationNames,
                          window: viewsWindow
                      })
                    : undefined;

            // Daily series for the ViewsWidget chart (fail-safe: undefined on error)
            const viewsDailySeriesData =
                dailySeriesResult.status === 'fulfilled' && dailySeriesResult.value.ok
                    ? transformViewsDailySeries({
                          // TYPE-WORKAROUND: apiClient returns a generic payload not inferred to the transform's input shape; the transform reads fields defensively.
                          series: dailySeriesResult.value.data as unknown as Record<string, unknown>
                      })
                    : undefined;

            // Cross favorites with names map (advanced-stats only)
            const favoritesData =
                hasAdvanced && favoritesResult.status === 'fulfilled' && favoritesResult.value.ok
                    ? transformFavoritesBreakdown({
                          favorites: favoritesResult.value.data as ReadonlyArray<
                              Record<string, unknown>
                          >,
                          names: accommodationNames
                      })
                    : undefined;

            const newErrors: WidgetErrors = {
                responseRate:
                    responseRateResult.status === 'rejected'
                        ? t(
                              'host.dashboard.analytics.responseRate.error',
                              'Error al cargar tiempo de respuesta'
                          )
                        : responseRateResult.status === 'fulfilled' && !responseRateResult.value.ok
                          ? responseRateResult.value.error.message
                          : null,
                inquiries:
                    inquiriesResult.status === 'rejected'
                        ? t('host.dashboard.analytics.inquiries.error', 'Error al cargar consultas')
                        : inquiriesResult.status === 'fulfilled' && !inquiriesResult.value.ok
                          ? inquiriesResult.value.error.message
                          : null,
                marketComparison: hasAdvanced
                    ? marketResult.status === 'rejected'
                        ? t(
                              'host.dashboard.analytics.marketComparison.error',
                              'Error al cargar comparación de mercado'
                          )
                        : marketResult.status === 'fulfilled' && !marketResult.value.ok
                          ? marketResult.value.error.message
                          : null
                    : null,
                views:
                    viewsResult.status === 'rejected'
                        ? t('host.dashboard.analytics.views.error', 'Error al cargar vistas')
                        : viewsResult.status === 'fulfilled' && !viewsResult.value.ok
                          ? viewsResult.value.error.message
                          : null,
                favorites: hasAdvanced
                    ? favoritesResult.status === 'rejected'
                        ? t('host.dashboard.analytics.favorites.error', 'Error al cargar favoritos')
                        : favoritesResult.status === 'fulfilled' && !favoritesResult.value.ok
                          ? favoritesResult.value.error.message
                          : null
                    : null
            };

            setErrors(newErrors);
            setState({
                status: 'ready',
                data: {
                    responseRate: responseRateData,
                    inquiries: inquiriesData,
                    marketComparison: marketData,
                    views: viewsData,
                    viewsDailySeries: viewsDailySeriesData,
                    favorites: favoritesData,
                    accommodationNames,
                    hasAdvanced
                }
            });
        } catch (err) {
            setState({
                status: 'error',
                message:
                    err instanceof Error
                        ? err.message
                        : t('host.dashboard.analytics.error', 'Error al cargar las estadísticas')
            });
        }
    }, []);

    // ── Handle views window change ────────────────────────────────────
    // Re-fetches both the cumulative list AND the daily series for the new
    // window, then updates both in state together.
    const handleViewsWindowChange = useCallback(
        async (w: '7d' | '30d') => {
            if (state.status !== 'ready') return;
            setViewsWindow(w);
            const [viewsResult, dailySeriesResult] = await Promise.allSettled([
                hostAnalyticsApi.getViews({ window: w }),
                hostAnalyticsApi.getViewsDailySeries({ window: w })
            ]);

            const newViewsData =
                viewsResult.status === 'fulfilled' && viewsResult.value.ok
                    ? transformAccommodationViews({
                          views: viewsResult.value.data as ReadonlyArray<Record<string, unknown>>,
                          names: state.data.accommodationNames,
                          window: w
                      })
                    : undefined;

            const newDailySeriesData =
                dailySeriesResult.status === 'fulfilled' && dailySeriesResult.value.ok
                    ? transformViewsDailySeries({
                          // TYPE-WORKAROUND: apiClient returns a generic payload not inferred to the transform's input shape; the transform reads fields defensively.
                          series: dailySeriesResult.value.data as unknown as Record<string, unknown>
                      })
                    : undefined;

            setState((prev) => {
                if (prev.status !== 'ready') return prev;
                return {
                    ...prev,
                    data: {
                        ...prev.data,
                        views: newViewsData ?? prev.data.views,
                        // On a window toggle, if the daily-series fetch fails we
                        // hide the chart (newDailySeriesData is undefined) rather
                        // than keep the PREVIOUS window's series, which would show
                        // stale data for the wrong window. The list keeps its own
                        // error handling below.
                        viewsDailySeries: newDailySeriesData
                    }
                };
            });

            if (
                viewsResult.status === 'rejected' ||
                (viewsResult.status === 'fulfilled' && !viewsResult.value.ok)
            ) {
                const msg =
                    viewsResult.status === 'fulfilled' && !viewsResult.value.ok
                        ? viewsResult.value.error.message
                        : t('host.dashboard.analytics.views.error', 'Error al cargar vistas');
                setErrors((prev) => ({ ...prev, views: msg }));
            } else {
                setErrors((prev) => ({ ...prev, views: null }));
            }
        },
        [state, t]
    );

    useEffect(() => {
        void fetchAnalytics();
    }, [fetchAnalytics]);

    // ── Render: loading ──────────────────────────────────────────────
    if (state.status === 'loading') {
        return (
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    {t('host.dashboard.analytics.sectionTitle', 'Estadísticas')}
                </h2>
                <div
                    className={styles.skeletonGrid}
                    data-testid="analytics-section-skeleton"
                    aria-hidden="true"
                >
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className={styles.skeletonWidget}
                        />
                    ))}
                </div>
            </section>
        );
    }

    // ── Render: error ────────────────────────────────────────────────
    if (state.status === 'error') {
        return (
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    {t('host.dashboard.analytics.sectionTitle', 'Estadísticas')}
                </h2>
                <div
                    className={styles.errorWidget}
                    role="alert"
                >
                    <p className={styles.errorText}>{state.message}</p>
                </div>
            </section>
        );
    }

    // ── Render: locked ───────────────────────────────────────────────
    if (state.status === 'locked') {
        return (
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    {t('host.dashboard.analytics.sectionTitle', 'Estadísticas')}
                </h2>
                <div className={styles.lockedWidget}>
                    <h3 className={styles.lockedTitle}>
                        {t(
                            'host.dashboard.analytics.locked.title',
                            'Estadísticas disponibles en tu próximo plan'
                        )}
                    </h3>
                    <p className={styles.lockedDescription}>
                        {t(
                            'host.dashboard.analytics.locked.description',
                            'Upgrade tu suscripción para ver estadísticas detalladas de tus propiedades.'
                        )}
                    </p>
                </div>
            </section>
        );
    }

    // ── Render: ready ────────────────────────────────────────────────
    const { data } = state;

    return (
        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
                {t('host.dashboard.analytics.sectionTitle', 'Estadísticas')}
            </h2>
            <div className={styles.analyticsGrid}>
                <ViewsWidget
                    locale={locale}
                    data={data.views}
                    dailySeries={data.viewsDailySeries}
                    isLoading={false}
                    error={errors.views}
                    onWindowChange={handleViewsWindowChange}
                />
                <ResponseRateWidget
                    locale={locale}
                    data={data.responseRate}
                    isLoading={false}
                    error={errors.responseRate}
                />
                <InquiryTrendWidget
                    locale={locale}
                    data={data.inquiries}
                    isLoading={false}
                    error={errors.inquiries}
                />
                {data.hasAdvanced ? (
                    <MarketComparisonWidget
                        locale={locale}
                        data={data.marketComparison}
                        isLoading={false}
                        error={errors.marketComparison}
                    />
                ) : null}
                {data.hasAdvanced ? (
                    <FavoritesWidget
                        locale={locale}
                        data={data.favorites}
                        isLoading={false}
                        error={errors.favorites}
                    />
                ) : null}
            </div>
        </section>
    );
}
