/**
 * @file FavoritesWidget.client.tsx
 * @description React island showing favorites breakdown across collections
 * as a horizontal bar visualization.
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
 * FavoritesWidget — horizontal bar breakdown of favorites per collection.
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
        return data.collections.reduce((sum, item) => sum + item.count, 0);
    }, [data]);

    const maxCount = useMemo(() => {
        if (!data || data.collections.length === 0) return 0;
        return Math.max(...data.collections.map((item) => item.count));
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
    if (!data || data.collections.length === 0) {
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

    return (
        <div className={styles.widget}>
            <div className={styles.header}>
                <h3 className={styles.title}>
                    {t('host.dashboard.analytics.favorites.title', 'Favoritos')}
                </h3>
                <span className={styles.total}>{totalFavorites}</span>
            </div>
            <div className={styles.list}>
                {data.collections.map((item) => {
                    const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                    return (
                        <div
                            key={item.collection}
                            className={styles.row}
                        >
                            <span className={styles.label}>{item.collection}</span>
                            <div className={styles.barTrack}>
                                <div
                                    className={styles.barFill}
                                    style={{ width: `${pct}%` }}
                                    aria-hidden="true"
                                />
                            </div>
                            <span className={styles.count}>{item.count}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
