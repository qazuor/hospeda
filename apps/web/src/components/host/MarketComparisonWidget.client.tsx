/**
 * @file MarketComparisonWidget.client.tsx
 * @description React island showing market comparison data in a table format
 * with rating and price badges vs destination average.
 *
 * @example
 * ```astro
 * <MarketComparisonWidget client:load locale={locale} data={marketData} isLoading={false} error={null} />
 * ```
 */

import type { MarketComparisonData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { JSX } from 'react';
import styles from './MarketComparisonWidget.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketComparisonWidgetProps {
    readonly locale: SupportedLocale;
    readonly data: MarketComparisonData | undefined;
    readonly isLoading: boolean;
    readonly error: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * MarketComparisonWidget — table comparing host's accommodations against
 * destination averages for rating, reviews, and price.
 *
 * @example
 * ```astro
 * <MarketComparisonWidget client:load locale={locale} data={data} isLoading={false} error={null} />
 * ```
 */
export function MarketComparisonWidget({
    locale,
    data,
    isLoading,
    error
}: MarketComparisonWidgetProps): JSX.Element {
    const { t } = createTranslations(locale);

    // ── Loading skeleton ────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className={styles.widget}>
                <div className={styles.header}>
                    <h3 className={styles.title}>
                        {t(
                            'host.dashboard.analytics.marketComparison.title',
                            'Comparación de mercado'
                        )}
                    </h3>
                </div>
                <div
                    className={styles.skeleton}
                    data-testid="market-comparison-skeleton"
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
                        {t(
                            'host.dashboard.analytics.marketComparison.title',
                            'Comparación de mercado'
                        )}
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
                        {t(
                            'host.dashboard.analytics.marketComparison.title',
                            'Comparación de mercado'
                        )}
                    </h3>
                </div>
                <div className={styles.empty}>
                    <p>
                        {t(
                            'host.dashboard.analytics.marketComparison.empty',
                            'Sin datos de comparación aún'
                        )}
                    </p>
                </div>
            </div>
        );
    }

    const formatRating = (rating: number | null): string =>
        rating != null ? rating.toFixed(1) : 'N/A';

    const formatPrice = (price: number | null): string =>
        price != null ? `$${price.toLocaleString('es-AR')}` : 'N/A';

    const getComparisonClass = (
        value: number | null,
        avg: number | null,
        higherIsBetter: boolean
    ): string => {
        if (value == null || avg == null) return '';
        if (higherIsBetter) {
            return value >= avg ? styles.badgePositive : styles.badgeNegative;
        }
        return value <= avg ? styles.badgePositive : styles.badgeNegative;
    };

    return (
        <div className={styles.widget}>
            <div className={styles.header}>
                <h3 className={styles.title}>
                    {t('host.dashboard.analytics.marketComparison.title', 'Comparación de mercado')}
                </h3>
            </div>
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th className={styles.th}>
                                {t(
                                    'host.dashboard.analytics.marketComparison.headers.accommodation',
                                    'Alojamiento'
                                )}
                            </th>
                            <th className={styles.th}>
                                {t(
                                    'host.dashboard.analytics.marketComparison.headers.yourRating',
                                    'Tu rating'
                                )}
                            </th>
                            <th className={styles.th}>
                                {t(
                                    'host.dashboard.analytics.marketComparison.headers.avgRating',
                                    'Prom. destino'
                                )}
                            </th>
                            <th className={styles.th}>
                                {t(
                                    'host.dashboard.analytics.marketComparison.headers.yourPrice',
                                    'Tu precio'
                                )}
                            </th>
                            <th className={styles.th}>
                                {t(
                                    'host.dashboard.analytics.marketComparison.headers.avgPrice',
                                    'Prom. precio'
                                )}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((item) => (
                            <tr
                                key={item.accommodationId}
                                className={styles.row}
                            >
                                <td className={styles.td}>
                                    <span className={styles.accommodationName}>
                                        {item.accommodationName}
                                    </span>
                                    <span className={styles.accommodationType}>
                                        {item.accommodationType}
                                    </span>
                                </td>
                                <td className={styles.td}>
                                    <span
                                        className={`${styles.badge} ${getComparisonClass(
                                            item.yourRating,
                                            item.destinationAvgRating,
                                            true
                                        )}`}
                                    >
                                        {formatRating(item.yourRating)}
                                    </span>
                                </td>
                                <td className={styles.td}>
                                    <span className={styles.badge}>
                                        {formatRating(item.destinationAvgRating)}
                                    </span>
                                </td>
                                <td className={styles.td}>
                                    <span
                                        className={`${styles.badge} ${getComparisonClass(
                                            item.yourPrice,
                                            item.destinationAvgPrice,
                                            false
                                        )}`}
                                    >
                                        {formatPrice(item.yourPrice)}
                                    </span>
                                </td>
                                <td className={styles.td}>
                                    <span className={styles.badge}>
                                        {formatPrice(item.destinationAvgPrice)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
