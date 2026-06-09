/**
 * @file InquiryTrendWidget.client.tsx
 * @description React island showing monthly inquiry trend as a line chart
 * with recharts. Displays 6-month trend with loading/error/empty states.
 *
 * @example
 * ```astro
 * <InquiryTrendWidget client:load locale={locale} data={inquiryData} isLoading={false} error={null} />
 * ```
 */

import type { InquiryTrendData } from '@/lib/api/types';
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
import styles from './InquiryTrendWidget.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InquiryTrendWidgetProps {
    readonly locale: SupportedLocale;
    readonly data: InquiryTrendData | undefined;
    readonly isLoading: boolean;
    readonly error: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * InquiryTrendWidget — line chart of monthly inquiries over 6 months.
 *
 * @example
 * ```astro
 * <InquiryTrendWidget client:load locale={locale} data={data} isLoading={false} error={null} />
 * ```
 */
export function InquiryTrendWidget({
    locale,
    data,
    isLoading,
    error
}: InquiryTrendWidgetProps): JSX.Element {
    const { t } = createTranslations(locale);

    const totalInquiries = useMemo(() => {
        if (!data) return 0;
        return data.months.reduce((sum, item) => sum + item.count, 0);
    }, [data]);

    // ── Loading skeleton ────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className={styles.widget}>
                <div className={styles.header}>
                    <h3 className={styles.title}>
                        {t('host.dashboard.analytics.inquiries.title', 'Consultas')}
                    </h3>
                </div>
                <div
                    className={styles.skeleton}
                    data-testid="inquiry-trend-skeleton"
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
                        {t('host.dashboard.analytics.inquiries.title', 'Consultas')}
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
    if (!data || data.months.length === 0) {
        return (
            <div className={styles.widget}>
                <div className={styles.header}>
                    <h3 className={styles.title}>
                        {t('host.dashboard.analytics.inquiries.title', 'Consultas')}
                    </h3>
                </div>
                <div className={styles.empty}>
                    <p>
                        {t(
                            'host.dashboard.analytics.inquiries.empty',
                            'Sin datos de consultas aún'
                        )}
                    </p>
                </div>
            </div>
        );
    }

    // ── Chart data ──────────────────────────────────────────────────────
    const chartData = data.months.map((item) => ({
        month: item.month.slice(5), // MM
        inquiries: item.count
    }));

    return (
        <div className={styles.widget}>
            <div className={styles.header}>
                <h3 className={styles.title}>
                    {t('host.dashboard.analytics.inquiries.title', 'Consultas')}
                </h3>
                <span className={styles.total}>{totalInquiries}</span>
            </div>
            <div
                className={styles.chartContainer}
                data-testid="inquiry-trend-chart"
            >
                <ResponsiveContainer
                    width="100%"
                    height={180}
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
                            dataKey="month"
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
                        <Line
                            type="monotone"
                            dataKey="inquiries"
                            stroke="var(--brand-accent)"
                            strokeWidth={2}
                            dot={{ r: 3, fill: 'var(--brand-accent)' }}
                            activeDot={{ r: 5 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
