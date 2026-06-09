/**
 * @file AnalyticsSection.client.tsx
 * @description Container component for the host analytics section.
 * Handles entitlement gating, parallel data fetching for all 5 analytics
 * endpoints, and renders widgets or a locked state based on entitlement.
 *
 * @example
 * ```astro
 * <AnalyticsSection client:load locale={locale} />
 * ```
 */

import { billingApi, hostAnalyticsApi } from '@/lib/api/endpoints-protected';
import {
    transformAccommodationViews,
    transformFavoritesBreakdown,
    transformInquiryTrend,
    transformMarketComparison,
    transformResponseRate
} from '@/lib/api/transforms';
import type {
    AccommodationViewsData,
    FavoritesBreakdownData,
    InquiryTrendData,
    MarketComparisonData,
    ResponseRateData
} from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { type JSX, useCallback, useEffect, useState } from 'react';
import styles from './AnalyticsSection.module.css';
import { FavoritesWidget } from './FavoritesWidget.client';
import { InquiryTrendWidget } from './InquiryTrendWidget.client';
import { MarketComparisonWidget } from './MarketComparisonWidget.client';
import { ResponseRateWidget } from './ResponseRateWidget.client';
import { ViewsWidget } from './ViewsWidget.client';

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
    readonly views: AccommodationViewsData | undefined;
    readonly favorites: FavoritesBreakdownData | undefined;
    readonly responseRate: ResponseRateData | undefined;
    readonly inquiries: InquiryTrendData | undefined;
    readonly marketComparison: MarketComparisonData | undefined;
}

interface WidgetErrors {
    readonly views: string | null;
    readonly favorites: string | null;
    readonly responseRate: string | null;
    readonly inquiries: string | null;
    readonly marketComparison: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AnalyticsSection — container that gates analytics behind entitlement and
 * renders all 5 analytics widgets with parallel data fetching.
 *
 * @example
 * ```astro
 * <AnalyticsSection client:load locale={locale} />
 * ```
 */
export function AnalyticsSection({ locale }: AnalyticsSectionProps): JSX.Element {
    const { t } = createTranslations(locale);
    const [state, setState] = useState<SectionState>({ status: 'loading' });
    const [viewsWindow, setViewsWindow] = useState<'7d' | '30d'>('7d');
    const [errors, setErrors] = useState<WidgetErrors>({
        views: null,
        favorites: null,
        responseRate: null,
        inquiries: null,
        marketComparison: null
    });

    // ── Fetch all analytics data ──────────────────────────────────────
    const fetchAnalytics = useCallback(async () => {
        setState({ status: 'loading' });
        setErrors({
            views: null,
            favorites: null,
            responseRate: null,
            inquiries: null,
            marketComparison: null
        });

        try {
            // Check entitlement first
            const entitlementResult = await billingApi.getEntitlements();
            if (!entitlementResult.ok) {
                setState({
                    status: 'error',
                    message:
                        entitlementResult.error.message ??
                        t('host.dashboard.analytics.error', 'Error al cargar las estadísticas')
                });
                return;
            }

            const hasEntitlement = entitlementResult.data.entitlements.includes('VIEW_BASIC_STATS');

            if (!hasEntitlement) {
                setState({ status: 'locked' });
                return;
            }

            // Fetch all 5 analytics endpoints in parallel
            const [
                viewsResult,
                favoritesResult,
                responseRateResult,
                inquiriesResult,
                marketResult
            ] = await Promise.allSettled([
                hostAnalyticsApi.getViews({ window: viewsWindow }),
                hostAnalyticsApi.getFavoritesBreakdown(),
                hostAnalyticsApi.getResponseRate(),
                hostAnalyticsApi.getInquiryTrend({ months: 6 }),
                hostAnalyticsApi.getMarketComparison()
            ]);

            // Process results — each widget handles its own error
            const viewsData =
                viewsResult.status === 'fulfilled' && viewsResult.value.ok
                    ? transformAccommodationViews({
                          item: viewsResult.value.data as unknown as Record<string, unknown>
                      })
                    : undefined;

            const favoritesData =
                favoritesResult.status === 'fulfilled' && favoritesResult.value.ok
                    ? transformFavoritesBreakdown({
                          item: favoritesResult.value.data as unknown as Record<string, unknown>
                      })
                    : undefined;

            const responseRateData =
                responseRateResult.status === 'fulfilled' && responseRateResult.value.ok
                    ? transformResponseRate({
                          item: responseRateResult.value.data as unknown as Record<string, unknown>
                      })
                    : undefined;

            const inquiriesData =
                inquiriesResult.status === 'fulfilled' && inquiriesResult.value.ok
                    ? transformInquiryTrend({
                          item: inquiriesResult.value.data as unknown as Record<string, unknown>
                      })
                    : undefined;

            const marketData =
                marketResult.status === 'fulfilled' && marketResult.value.ok
                    ? transformMarketComparison({
                          item: marketResult.value.data as unknown as Record<string, unknown>
                      })
                    : undefined;

            // Collect per-widget errors
            const newErrors: WidgetErrors = {
                views:
                    viewsResult.status === 'rejected'
                        ? 'Error al cargar vistas'
                        : viewsResult.status === 'fulfilled' && !viewsResult.value.ok
                          ? viewsResult.value.error.message
                          : null,
                favorites:
                    favoritesResult.status === 'rejected'
                        ? 'Error al cargar favoritos'
                        : favoritesResult.status === 'fulfilled' && !favoritesResult.value.ok
                          ? favoritesResult.value.error.message
                          : null,
                responseRate:
                    responseRateResult.status === 'rejected'
                        ? 'Error al cargar tiempo de respuesta'
                        : responseRateResult.status === 'fulfilled' && !responseRateResult.value.ok
                          ? responseRateResult.value.error.message
                          : null,
                inquiries:
                    inquiriesResult.status === 'rejected'
                        ? 'Error al cargar consultas'
                        : inquiriesResult.status === 'fulfilled' && !inquiriesResult.value.ok
                          ? inquiriesResult.value.error.message
                          : null,
                marketComparison:
                    marketResult.status === 'rejected'
                        ? 'Error al cargar comparación de mercado'
                        : marketResult.status === 'fulfilled' && !marketResult.value.ok
                          ? marketResult.value.error.message
                          : null
            };

            setErrors(newErrors);
            setState({
                status: 'ready',
                data: {
                    views: viewsData,
                    favorites: favoritesData,
                    responseRate: responseRateData,
                    inquiries: inquiriesData,
                    marketComparison: marketData
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
    }, [viewsWindow, t]);

    useEffect(() => {
        void fetchAnalytics();
    }, [fetchAnalytics]);

    // ── Views window change handler ────────────────────────────────────
    const handleViewsWindowChange = useCallback((window: '7d' | '30d') => {
        setViewsWindow(window);
    }, []);

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
                    {[1, 2, 3, 4, 5].map((i) => (
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
                {/* Row 1: 3 KPI widgets */}
                <ViewsWidget
                    locale={locale}
                    data={data.views}
                    isLoading={false}
                    error={errors.views}
                    onWindowChange={handleViewsWindowChange}
                />
                <FavoritesWidget
                    locale={locale}
                    data={data.favorites}
                    isLoading={false}
                    error={errors.favorites}
                />
                <ResponseRateWidget
                    locale={locale}
                    data={data.responseRate}
                    isLoading={false}
                    error={errors.responseRate}
                />
                {/* Row 2: 2 detail widgets */}
                <InquiryTrendWidget
                    locale={locale}
                    data={data.inquiries}
                    isLoading={false}
                    error={errors.inquiries}
                />
                <MarketComparisonWidget
                    locale={locale}
                    data={data.marketComparison}
                    isLoading={false}
                    error={errors.marketComparison}
                />
            </div>
        </section>
    );
}
