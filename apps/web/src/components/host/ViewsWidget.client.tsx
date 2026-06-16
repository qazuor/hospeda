/**
 * @file ViewsWidget.client.tsx
 * @description React island showing the host's accommodations ranked by total
 * views over a selected time window (7d / 30d). Renders a daily line chart
 * (via recharts) above a top-6 per-property ranked list. The 7d/30d toggle
 * controls both the chart and the list.
 *
 * @example
 * ```astro
 * <ViewsWidget client:load locale={locale} data={viewsData} dailySeries={seriesData} isLoading={false} error={null} onWindowChange={handleWindowChange} />
 * ```
 */

import type { AccommodationViewsData, HostViewDailySeriesData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { type JSX, useMemo } from 'react';
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import styles from './ViewsWidget.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ViewsWidgetProps {
    readonly locale: SupportedLocale;
    readonly data: AccommodationViewsData | undefined;
    /** Optional daily series for the trend chart. When provided and non-empty,
     * renders a line chart ABOVE the ranked list. Backward compatible — if
     * absent the widget renders exactly as before (list only). */
    readonly dailySeries?: HostViewDailySeriesData | undefined;
    readonly isLoading: boolean;
    readonly error: string | null;
    readonly onWindowChange: (window: '7d' | '30d') => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ViewsWidget — line chart (daily trend) + ranked list of the host's
 * accommodations by total views, with a 7d/30d time window toggle.
 *
 * @example
 * ```astro
 * <ViewsWidget client:load locale={locale} data={viewsData} dailySeries={series} isLoading={false} error={null} onWindowChange={setWindow} />
 * ```
 */
export function ViewsWidget({
    locale,
    data,
    dailySeries,
    isLoading,
    error,
    onWindowChange
}: ViewsWidgetProps): JSX.Element {
    const { t } = createTranslations(locale);

    const totalViews = useMemo(() => {
        if (!data) return 0;
        return data.items.reduce((sum, item) => sum + item.total, 0);
    }, [data]);

    const isEmpty = useMemo(() => {
        if (!data || data.items.length === 0) return true;
        return data.items.every((item) => item.total === 0);
    }, [data]);

    /** Chart data: map series items to recharts-friendly shape with short date label */
    const chartData = useMemo(() => {
        if (!dailySeries || dailySeries.items.length === 0) return [];
        return dailySeries.items.map((point) => ({
            // Show "DD/MM" label — e.g. "2026-06-15" → "15/06"
            label: `${point.date.slice(8, 10)}/${point.date.slice(5, 7)}`,
            total: point.total
        }));
    }, [dailySeries]);

    const hasChart = chartData.length > 0;

    // ── Loading skeleton ────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className={styles.widget}>
                <div className={styles.header}>
                    <h3 className={styles.title}>
                        {t('host.dashboard.analytics.views.title', 'Vistas')}
                    </h3>
                </div>
                <div
                    className={styles.skeleton}
                    data-testid="views-skeleton"
                    aria-hidden="true"
                />
            </div>
        );
    }

    // ── Error state ─────────────────────────────────────────────────────
    if (error) {
        return (
            <div className={styles.widget}>
                <div className={styles.header}>
                    <h3 className={styles.title}>
                        {t('host.dashboard.analytics.views.title', 'Vistas')}
                    </h3>
                </div>
                <div
                    className={styles.error}
                    role="alert"
                >
                    <p className={styles.errorText}>{error}</p>
                </div>
            </div>
        );
    }

    // ── Empty state ─────────────────────────────────────────────────────
    if (isEmpty) {
        return (
            <div className={styles.widget}>
                <div className={styles.header}>
                    <h3 className={styles.title}>
                        {t('host.dashboard.analytics.views.title', 'Vistas')}
                    </h3>
                </div>
                <div className={styles.empty}>
                    <p>{t('host.dashboard.analytics.views.empty', 'Sin datos de vistas aún')}</p>
                </div>
            </div>
        );
    }

    // ── Ready — chart (if available) + ranked list ───────────────────
    // At this point data is guaranteed non-null (isEmpty guard above catches undefined)
    const readyData = data as AccommodationViewsData;
    const topItems = readyData.items.slice(0, 6);

    return (
        <div className={styles.widget}>
            <div className={styles.header}>
                <h3 className={styles.title}>
                    {t('host.dashboard.analytics.views.title', 'Vistas')}
                </h3>
                <span className={styles.total}>{totalViews}</span>
            </div>
            <fieldset className={styles.toggle}>
                <button
                    type="button"
                    className={`${styles.toggleBtn} ${readyData.window === '7d' ? styles.toggleActive : ''}`}
                    aria-pressed={readyData.window === '7d'}
                    onClick={() => onWindowChange('7d')}
                >
                    {t('host.dashboard.analytics.views.window.7d', '7d')}
                </button>
                <button
                    type="button"
                    className={`${styles.toggleBtn} ${readyData.window === '30d' ? styles.toggleActive : ''}`}
                    aria-pressed={readyData.window === '30d'}
                    onClick={() => onWindowChange('30d')}
                >
                    {t('host.dashboard.analytics.views.window.30d', '30d')}
                </button>
            </fieldset>
            {hasChart ? (
                <div
                    className={styles.chartContainer}
                    data-testid="views-daily-chart"
                    aria-label={t(
                        'host.dashboard.analytics.views.chart.ariaLabel',
                        'Tendencia diaria de vistas'
                    )}
                >
                    <ResponsiveContainer
                        width="100%"
                        height={160}
                    >
                        <LineChart
                            data={chartData}
                            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="var(--core-foreground-a08)"
                            />
                            <XAxis
                                dataKey="label"
                                tick={{ fontSize: 10, fill: 'var(--core-muted-foreground)' }}
                                axisLine={false}
                                tickLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: 'var(--core-muted-foreground)' }}
                                axisLine={false}
                                tickLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'var(--core-card)',
                                    border: '1px solid var(--core-foreground-a15)',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: 12
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="total"
                                stroke="var(--brand-accent)"
                                strokeWidth={2}
                                dot={{ r: 3, fill: 'var(--brand-accent)' }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ) : null}
            <ul className={styles.list}>
                {topItems.map((item) => (
                    <li
                        key={item.accommodationId}
                        className={styles.row}
                    >
                        <span className={styles.rowName}>
                            {item.name || t('host.dashboard.analytics.views.unnamed', 'Sin nombre')}
                        </span>
                        <span className={styles.rowValue}>{item.total}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
