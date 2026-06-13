/**
 * @file AnalyticsSection.client.tsx
 * @description Container component for the host analytics section.
 * Handles entitlement gating and parallel data fetching for the wired
 * analytics endpoints, then renders the available widgets or a locked state.
 *
 * @remarks
 * SPEC-207 status: the Views and Favorites widgets are NOT mounted yet. The
 * backend does not expose a per-host daily-series views endpoint, and the
 * favorites endpoint returns per-accommodation counts (not "collections").
 * Both are deferred to SPEC-207, which will build the views daily-series
 * endpoint and redesign the favorites widget to the per-accommodation shape.
 * Only Response Rate + Inquiry Trend (VIEW_BASIC_STATS) and Market Comparison
 * (VIEW_ADVANCED_STATS) are wired here.
 *
 * @example
 * ```astro
 * <AnalyticsSection client:load locale={locale} />
 * ```
 */

import { billingApi, hostAnalyticsApi } from '@/lib/api/endpoints-protected';
import {
    transformInquiryTrend,
    transformMarketComparison,
    transformResponseRate
} from '@/lib/api/transforms';
import type { InquiryTrendData, MarketComparisonData, ResponseRateData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { type JSX, useCallback, useEffect, useState } from 'react';
import styles from './AnalyticsSection.module.css';
import { InquiryTrendWidget } from './InquiryTrendWidget.client';
import { MarketComparisonWidget } from './MarketComparisonWidget.client';
import { ResponseRateWidget } from './ResponseRateWidget.client';

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
    /** Whether the user holds VIEW_ADVANCED_STATS — gates the market widget. */
    readonly hasAdvanced: boolean;
}

interface WidgetErrors {
    readonly responseRate: string | null;
    readonly inquiries: string | null;
    readonly marketComparison: string | null;
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
        marketComparison: null
    });

    // ── Fetch analytics data ──────────────────────────────────────────
    // biome-ignore lint/correctness/useExhaustiveDependencies: t is a stable translation function, not reactive
    const fetchAnalytics = useCallback(async () => {
        setState({ status: 'loading' });
        setErrors({ responseRate: null, inquiries: null, marketComparison: null });

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

            // Fetch the wired analytics endpoints in parallel. Market comparison
            // requires VIEW_ADVANCED_STATS, so only fetch it when entitled —
            // otherwise the widget is hidden (not shown as an error).
            const [responseRateResult, inquiriesResult, marketResult] = await Promise.allSettled([
                hostAnalyticsApi.getResponseRate(),
                hostAnalyticsApi.getInquiryTrend({ months: 6 }),
                hasAdvanced ? hostAnalyticsApi.getMarketComparison() : Promise.resolve(undefined)
            ]);

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
                hasAdvanced &&
                marketResult.status === 'fulfilled' &&
                marketResult.value &&
                marketResult.value.ok
                    ? transformMarketComparison({
                          item: marketResult.value.data as unknown as Record<string, unknown>
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
                    : null
            };

            setErrors(newErrors);
            setState({
                status: 'ready',
                data: {
                    responseRate: responseRateData,
                    inquiries: inquiriesData,
                    marketComparison: marketData,
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
