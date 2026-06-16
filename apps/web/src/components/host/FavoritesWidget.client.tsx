/**
 * @file FavoritesWidget.client.tsx
 * @description React island showing the host's accommodations ranked by
 * bookmark count (favorites). Renders a top-6 horizontal bar list with each
 * property's name and bookmark count. Uses no charting library — plain semantic
 * HTML with CSS Module styling, mirroring ViewsWidget.
 *
 * Gated by the `view_advanced_stats` entitlement (mounted by AnalyticsSection
 * only when the entitlement is present).
 *
 * @example
 * ```astro
 * <FavoritesWidget client:load locale={locale} data={favoritesData} isLoading={false} error={null} />
 * ```
 */

import type { FavoritesBreakdownData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { type JSX, useMemo } from 'react';
import styles from './FavoritesWidget.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FavoritesWidgetProps {
    readonly locale: SupportedLocale;
    readonly data: FavoritesBreakdownData | undefined;
    readonly isLoading: boolean;
    readonly error: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * FavoritesWidget — ranked horizontal bar list of the host's accommodations
 * by bookmark count (top 6, sorted descending).
 *
 * @example
 * ```astro
 * <FavoritesWidget client:load locale={locale} data={data} isLoading={false} error={null} />
 * ```
 */
export function FavoritesWidget({
    locale,
    data,
    isLoading,
    error
}: FavoritesWidgetProps): JSX.Element {
    const { t } = createTranslations(locale);

    const totalFavorites = useMemo(() => {
        if (!data) return 0;
        return data.items.reduce((sum, item) => sum + item.bookmarkCount, 0);
    }, [data]);

    const maxCount = useMemo(() => {
        if (!data || data.items.length === 0) return 0;
        return Math.max(...data.items.map((item) => item.bookmarkCount));
    }, [data]);

    // ── Loading skeleton ────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className={styles.widget}>
                <div className={styles.header}>
                    <h3 className={styles.title}>
                        {t('host.dashboard.analytics.favorites.title', 'Favoritos')}
                    </h3>
                </div>
                <div
                    className={styles.skeleton}
                    data-testid="favorites-skeleton"
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
                        {t('host.dashboard.analytics.favorites.title', 'Favoritos')}
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
                        {t('host.dashboard.analytics.favorites.title', 'Favoritos')}
                    </h3>
                </div>
                <div className={styles.empty}>
                    <p>{t('host.dashboard.analytics.favorites.empty', 'Sin favoritos aún')}</p>
                </div>
            </div>
        );
    }

    // ── Ready — ranked bar list (already sorted desc by transformFavoritesBreakdown) ─
    // At this point data is guaranteed non-null (empty guard above catches undefined)
    const readyData = data as FavoritesBreakdownData;
    const topItems = readyData.items.slice(0, 6);

    return (
        <div className={styles.widget}>
            <div className={styles.header}>
                <h3 className={styles.title}>
                    {t('host.dashboard.analytics.favorites.title', 'Favoritos')}
                </h3>
                <span className={styles.total}>{totalFavorites}</span>
            </div>
            <div className={styles.list}>
                {topItems.map((item) => {
                    const pct = maxCount > 0 ? (item.bookmarkCount / maxCount) * 100 : 0;
                    return (
                        <div
                            key={item.accommodationId}
                            className={styles.row}
                        >
                            <span className={styles.label}>{item.name}</span>
                            <div className={styles.barTrack}>
                                <div
                                    className={styles.barFill}
                                    style={{ width: `${pct}%` }}
                                    aria-hidden="true"
                                />
                            </div>
                            <span className={styles.count}>{item.bookmarkCount}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
