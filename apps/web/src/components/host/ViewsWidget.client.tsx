/**
 * @file ViewsWidget.client.tsx
 * @description React island showing accommodation views as a bar chart
 * with 7d/30d time window toggle. Uses recharts for chart rendering.
 *
 * @example
 * ```astro
 * <ViewsWidget client:load locale={locale} data={viewsData} isLoading={false} error={null} onWindowChange={handleWindowChange} />
 * ```
 */

import type { AccommodationViewsData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { type JSX, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import styles from './ViewsWidget.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ViewsWidgetProps {
    readonly locale: SupportedLocale;
    readonly data: AccommodationViewsData | undefined;
    readonly isLoading: boolean;
    readonly error: string | null;
    readonly onWindowChange: (window: '7d' | '30d') => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ViewsWidget — bar chart of accommodation views with 7d/30d toggle.
 *
 * @example
 * ```astro
 * <ViewsWidget client:load locale={locale} data={viewsData} isLoading={false} error={null} onWindowChange={setWindow} />
 * ```
 */
export function ViewsWidget({
    locale,
    data,
    isLoading,
    error,
    onWindowChange
}: ViewsWidgetProps): JSX.Element {
    const { t } = createTranslations(locale);

    const totalViews = useMemo(() => {
        if (!data) return 0;
        return data.items.reduce((sum, item) => sum + item.count, 0);
    }, [data]);

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
    if (!data || data.items.length === 0) {
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

    // ── Chart data ──────────────────────────────────────────────────────
    const chartData = data.items.map((item) => ({
        date: item.date.slice(5), // MM-DD
        views: item.count
    }));

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
                    className={`${styles.toggleBtn} ${data.window === '7d' ? styles.toggleActive : ''}`}
                    aria-pressed={data.window === '7d'}
                    onClick={() => onWindowChange('7d')}
                >
                    {t('host.dashboard.analytics.views.window.7d', '7d')}
                </button>
                <button
                    type="button"
                    className={`${styles.toggleBtn} ${data.window === '30d' ? styles.toggleActive : ''}`}
                    aria-pressed={data.window === '30d'}
                    onClick={() => onWindowChange('30d')}
                >
                    {t('host.dashboard.analytics.views.window.30d', '30d')}
                </button>
            </fieldset>
            <div
                className={styles.chartContainer}
                data-testid="views-chart"
            >
                <ResponsiveContainer
                    width="100%"
                    height={180}
                >
                    <BarChart
                        data={chartData}
                        margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--core-foreground-a08)"
                        />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: 'var(--core-muted-foreground)' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: 'var(--core-muted-foreground)' }}
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
                        <Bar
                            dataKey="views"
                            fill="var(--brand-primary)"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={32}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
