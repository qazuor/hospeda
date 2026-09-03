/**
 * @file CommerceViewsWidget.client.tsx
 * @description Basic view-count widget for the `mi-cuenta/comercio` owner
 * index (HOS-734).
 *
 * Shows, per commerce listing the owner has (gastronomy and/or experience),
 * how many unique/total visits it got over a rolling window (7d/30d) —
 * mirrors the accommodation host dashboard's `ViewsWidget`, scoped down to
 * the one stat commerce has today.
 *
 * **Why no "locked" state, unlike the accommodation widget.** `VIEW_BASIC_STATS`
 * is in `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — the floor EVERY tier of a
 * commerce vertical gets (HOS-734), so there is no commerce owner this widget
 * would ever need to gate. A fetch failure (403 should not normally happen,
 * but a 500 or network error can) degrades to a plain inline error message
 * instead of a CTA — there's no plan to upsell into.
 *
 * **What's explicitly NOT here (owner decision, HOS-734):** the daily-series
 * chart (API route exists, `commerceAnalyticsApi.getViewsDailySeries`, ready
 * for a future addition) and any advanced stat — QR scans / most-viewed
 * dishes for gastronomy, origin destinations for experiences. Those need
 * their own spec, per vertical.
 *
 * Hydration: `client:visible` — sits below the listing list, not above the
 * fold.
 */

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { commerceAnalyticsApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './CommerceViewsWidget.module.css';

/** The two commerce verticals this widget supports. */
type CommerceVertical = 'gastronomy' | 'experience';

/** Minimal listing shape the widget needs — id, vertical, and display name. */
export interface CommerceViewsWidgetListing {
    readonly id: string;
    readonly vertical: CommerceVertical;
    readonly name: string;
}

export interface CommerceViewsWidgetProps {
    readonly locale: SupportedLocale;
    /** The owner's own listings (both verticals), already loaded by the page. */
    readonly listings: readonly CommerceViewsWidgetListing[];
}

/** Per-listing row shape once view stats are resolved. */
interface ViewRow {
    readonly id: string;
    readonly name: string;
    readonly unique: number;
    readonly total: number;
}

type WidgetState =
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly rows: readonly ViewRow[] }
    | { readonly status: 'error' };

/**
 * Fetches view stats for every distinct vertical present in `listings` and
 * zips the results with each listing's display name.
 */
async function fetchRows(
    listings: readonly CommerceViewsWidgetListing[],
    windowParam: '7d' | '30d'
): Promise<readonly ViewRow[] | null> {
    const verticals = [...new Set(listings.map((l) => l.vertical))];
    const nameById = new Map(listings.map((l) => [l.id, l.name] as const));

    const results = await Promise.all(
        verticals.map((vertical) =>
            commerceAnalyticsApi.getViews({ vertical, window: windowParam })
        )
    );

    if (results.some((r) => !r.ok)) {
        return null;
    }

    const rows: ViewRow[] = [];
    for (const result of results) {
        if (!result.ok) continue;
        for (const item of result.data) {
            rows.push({
                id: item.entityId,
                name: nameById.get(item.entityId) ?? item.entityId,
                unique: item.unique,
                total: item.total
            });
        }
    }
    return rows;
}

/**
 * CommerceViewsWidget — per-listing basic view stats for gastronomy and
 * experience owners, with a 7d/30d toggle.
 *
 * @example
 * ```astro
 * <CommerceViewsWidget client:visible locale={locale} listings={listings} />
 * ```
 */
export function CommerceViewsWidget({
    locale,
    listings
}: CommerceViewsWidgetProps): JSX.Element | null {
    const { t } = createTranslations(locale);
    const [windowParam, setWindowParam] = useState<'7d' | '30d'>('30d');
    const [state, setState] = useState<WidgetState>({ status: 'loading' });

    useEffect(() => {
        let cancelled = false;

        if (listings.length === 0) {
            setState({ status: 'ready', rows: [] });
            return;
        }

        setState({ status: 'loading' });
        fetchRows(listings, windowParam).then((rows) => {
            if (cancelled) return;
            setState(rows === null ? { status: 'error' } : { status: 'ready', rows });
        });

        return () => {
            cancelled = true;
        };
    }, [listings, windowParam]);

    if (listings.length === 0) {
        return null;
    }

    return (
        <div
            className={styles.widget}
            data-testid="commerce-views-widget"
        >
            <div className={styles.header}>
                <h2 className={styles.title}>{t('commerce.owner.list.views.title', 'Vistas')}</h2>
                <div className={styles.toggle}>
                    <button
                        type="button"
                        className={windowParam === '7d' ? styles.toggleActive : styles.toggleButton}
                        onClick={() => setWindowParam('7d')}
                        aria-pressed={windowParam === '7d'}
                    >
                        {t('commerce.owner.list.views.window7d', '7 días')}
                    </button>
                    <button
                        type="button"
                        className={
                            windowParam === '30d' ? styles.toggleActive : styles.toggleButton
                        }
                        onClick={() => setWindowParam('30d')}
                        aria-pressed={windowParam === '30d'}
                    >
                        {t('commerce.owner.list.views.window30d', '30 días')}
                    </button>
                </div>
            </div>

            {state.status === 'error' && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {t(
                        'commerce.owner.list.views.error',
                        'No pudimos cargar las vistas. Probá de nuevo más tarde.'
                    )}
                </p>
            )}

            {state.status === 'ready' && (
                <ul
                    className={styles.list}
                    data-testid="commerce-views-list"
                >
                    {state.rows.map((row) => (
                        <li
                            key={row.id}
                            className={styles.row}
                            data-testid="commerce-views-row"
                        >
                            <span className={styles.rowName}>{row.name}</span>
                            <span className={styles.rowStats}>
                                <span data-testid="commerce-views-unique">
                                    {row.unique} {t('commerce.owner.list.views.unique', 'únicos')}
                                </span>
                                <span data-testid="commerce-views-total">
                                    {row.total} {t('commerce.owner.list.views.total', 'totales')}
                                </span>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
