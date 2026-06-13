/**
 * @file AnalyticsSection.client.tsx
 * @description Container component for the host analytics section.
 * Handles entitlement gating and parallel data fetching for the wired
 * analytics endpoints, then renders the available widgets or a locked state.
 *
 * @remarks
 * SPEC-207 status: the Views widget is now mounted as a per-property ranked
 * list (cumulative counts via GET /views/accommodations/me). Only the
 * daily-series chart variant and the Favorites widget remain deferred to
 * SPEC-207. Response Rate + Inquiry Trend (VIEW_BASIC_STATS) and Market
 * Comparison (VIEW_ADVANCED_STATS) continue to be wired as before.
 *
 * @example
 * ```astro
 * <AnalyticsSection client:load locale={locale} />
 * ```
 */

import { billingApi, hostAnalyticsApi } from '@/lib/api/endpoints-protected';
import {
    transformAccommodationViews,
    transformInquiryTrend,
    transformMarketComparison,
    transformResponseRate
} from '@/lib/api/transforms';
import type {
    AccommodationViewsData,
    InquiryTrendData,
    MarketComparisonData,
    ResponseRateData
} from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { type JSX, useCallback, useEffect, useState } from 'react';
import styles from './AnalyticsSection.module.css';
import { InquiryTrendWidget } from './InquiryTrendWidget.client';
import { MarketComparisonWidget } from './MarketComparisonWidget.client';
import { ResponseRateWidget } from './ResponseRateWidget.client';
import { ViewsWidget } from './ViewsWidget.client';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Entitlement key literals. Kept as plain strings (not coupled to the
 * `EntitlementKey` enum in `@repo/billing`) to avoid pulling server-only
 * billing deps into the client bundle — mirroring how `@repo/schemas` keeps
 * entitlement keys as plain strings. These MUST match the wire values emitted
 * by the backend (`EntitlementKey.VIEW_BASIC_STATS` / `VIEW_ADVANCED_STATS`).
 */
const ENTITLEMENT_VIEW_BASIC_STATS = 'view_basic_stats';
const ENTITLEMENT_VIEW_ADVANCED_STATS = 'view_advanced_stats';

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
    /** Stored names map so window toggle can re-cross without re-listing. */
    readonly accommodationNames: ReadonlyMap<string, string>;
    /** Whether the user holds VIEW_ADVANCED_STATS — gates the market widget. */
    readonly hasAdvanced: boolean;
}

interface WidgetErrors {
    readonly responseRate: string | null;
    readonly inquiries: string | null;
    readonly marketComparison: string | null;
    readonly views: string | null;
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
        views: null
    });
    const [viewsWindow, setViewsWindow] = useState<'7d' | '30d'>('30d');

    // ── Fetch analytics data ──────────────────────────────────────────
    // biome-ignore lint/correctness/useExhaustiveDependencies: runs ONCE on mount. `t` is a stable translation function; `viewsWindow` is intentionally read as its initial value here — subsequent window changes are handled by handleViewsWindowChange (which re-fetches ONLY views), so this effect must NOT depend on viewsWindow or it would re-fetch the whole section on every toggle.
    const fetchAnalytics = useCallback(async () => {
        setState({ status: 'loading' });
        setErrors({ responseRate: null, inquiries: null, marketComparison: null, views: null });

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

            const { entitlements } = entitlementResult.data;
            const hasBasic = entitlements.includes(ENTITLEMENT_VIEW_BASIC_STATS);

            if (!hasBasic) {
                setState({ status: 'locked' });
                return;
            }

            const hasAdvanced = entitlements.includes(ENTITLEMENT_VIEW_ADVANCED_STATS);

            // Fetch all wired analytics endpoints in parallel. Market comparison
            // requires VIEW_ADVANCED_STATS; views is gated by basic (already passed).
            const [responseRateResult, inquiriesResult, marketResult, viewsResult, namesResult] =
                await Promise.allSettled([
                    hostAnalyticsApi.getResponseRate(),
                    hostAnalyticsApi.getInquiryTrend({ months: 6 }),
                    hasAdvanced
                        ? hostAnalyticsApi.getMarketComparison()
                        : Promise.resolve(undefined),
                    hostAnalyticsApi.getViews({ window: viewsWindow }),
                    hostAnalyticsApi.listOwnAccommodations()
                ]);

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
                hasAdvanced &&
                marketResult.status === 'fulfilled' &&
                marketResult.value &&
                marketResult.value.ok
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
                        : marketResult.status === 'fulfilled' &&
                            marketResult.value &&
                            !marketResult.value.ok
                          ? marketResult.value.error.message
                          : null
                    : null,
                views:
                    viewsResult.status === 'rejected'
                        ? t('host.dashboard.analytics.views.error', 'Error al cargar vistas')
                        : viewsResult.status === 'fulfilled' && !viewsResult.value.ok
                          ? viewsResult.value.error.message
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

    // ── Handle views window change (re-fetches only views, re-crosses with stored names) ──
    const handleViewsWindowChange = useCallback(
        async (w: '7d' | '30d') => {
            if (state.status !== 'ready') return;
            setViewsWindow(w);
            const result = await hostAnalyticsApi.getViews({ window: w });
            if (result.ok) {
                const viewsData = transformAccommodationViews({
                    views: result.data as ReadonlyArray<Record<string, unknown>>,
                    names: state.data.accommodationNames,
                    window: w
                });
                setState((prev) => {
                    if (prev.status !== 'ready') return prev;
                    return {
                        ...prev,
                        data: { ...prev.data, views: viewsData }
                    };
                });
                setErrors((prev) => ({ ...prev, views: null }));
            } else {
                setErrors((prev) => ({
                    ...prev,
                    views: result.error.message
                }));
            }
        },
        [state]
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
            </div>
        </section>
    );
}
