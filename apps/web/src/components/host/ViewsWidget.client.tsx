/**
 * @file ViewsWidget.client.tsx
 * @description React island showing the host's accommodations ranked by total
 * views over a selected time window (7d / 30d). Renders a top-6 list with
 * each property's name and view count. Uses no charting library — plain
 * semantic HTML with CSS Module styling.
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
 * ViewsWidget — ranked list of the host's accommodations by total views with
 * a 7d/30d time window toggle.
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
        return data.items.reduce((sum, item) => sum + item.total, 0);
    }, [data]);

    const isEmpty = useMemo(() => {
        if (!data || data.items.length === 0) return true;
        return data.items.every((item) => item.total === 0);
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

    // ── Ready — ranked list (top 6 already sorted desc by transformAccommodationViews) ─
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
