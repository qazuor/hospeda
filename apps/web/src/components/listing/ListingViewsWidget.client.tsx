/**
 * @file ListingViewsWidget.client.tsx
 * @description Basic view-count widget for the `mi-cuenta/comercio` owner
 * index (HOS-734).
 *
 * Shows, per listing the owner has (venue and/or experience),
 * how many unique/total visits it got over a rolling window (7d/30d) —
 * mirrors the accommodation host dashboard's `ViewsWidget`, scoped down to
 * the one stat a venue or experience listing has today.
 *
 * **The one "locked" case is an owner with no tier at all.** `VIEW_BASIC_STATS`
 * is in the entitlement set of every tier of a vertical (HOS-734), and the
 * trial grants it too, so there is no plan to upsell into. But an owner whose
 * listing was never published (no trial yet), or whose trial ended unpaid,
 * holds no tier, and the API answers `403`. That is a real state, measured on
 * staging (2026-10-29), so it renders as an informative `locked` sentence, not
 * as the "could not load" error it used to fall into. Any other failure (a 500,
 * the network) is still the error.
 *
 * **What's explicitly NOT here (owner decision, HOS-734):** the daily-series
 * chart (API route exists, `listingAnalyticsApi.getViewsDailySeries`, ready
 * for a future addition) and most-viewed dishes for venue / origin
 * destinations for experiences — those still need their own spec, per
 * vertical. Venue's menu QR and its scan analytics are NOT in that list
 * anymore: HOS-1044 built them (`VenueMenuQrWidget.client.tsx`, gated by
 * the `menu_qr_scan_metrics` entitlement), rendered as a separate widget below
 * this one rather than folded in here.
 *
 * Hydration: `client:visible` — sits below the listing list, not above the
 * fold.
 */

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { listingAnalyticsApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';
import styles from './ListingViewsWidget.module.css';

/** Minimal listing shape the widget needs — id, vertical, and display name. */
export interface ListingViewsWidgetListing {
    readonly id: string;
    readonly vertical: VenueOrExperience;
    readonly name: string;
}

export interface ListingViewsWidgetProps {
    readonly locale: SupportedLocale;
    /** The owner's own listings (both verticals), already loaded by the page. */
    readonly listings: readonly ListingViewsWidgetListing[];
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
    | { readonly status: 'locked' }
    | { readonly status: 'error' };

/**
 * Fetches view stats for every distinct vertical present in `listings` and
 * zips the results with each listing's display name.
 */
async function fetchRows(
    listings: readonly ListingViewsWidgetListing[],
    windowParam: '7d' | '30d'
): Promise<readonly ViewRow[] | 'locked' | null> {
    const verticals = [...new Set(listings.map((l) => l.vertical))];
    const nameById = new Map(listings.map((l) => [l.id, l.name] as const));

    const results = await Promise.all(
        verticals.map((vertical) => listingAnalyticsApi.getViews({ vertical, window: windowParam }))
    );

    const failures = results.filter((r) => !r.ok);
    if (failures.length > 0) {
        // Locked only when EVERY failure is the entitlement refusal; anything
        // else in the mix is a genuine error and must say so.
        return failures.every((r) => !r.ok && r.error.status === 403) ? 'locked' : null;
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
 * ListingViewsWidget — per-listing basic view stats for venue and
 * experience owners, with a 7d/30d toggle.
 *
 * @example
 * ```astro
 * <ListingViewsWidget client:visible locale={locale} listings={listings} />
 * ```
 */
export function ListingViewsWidget({
    locale,
    listings
}: ListingViewsWidgetProps): JSX.Element | null {
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
            if (rows === null) {
                setState({ status: 'error' });
            } else if (rows === 'locked') {
                setState({ status: 'locked' });
            } else {
                setState({ status: 'ready', rows });
            }
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
            data-testid="listing-views-widget"
        >
            <div className={styles.header}>
                <h2 className={styles.title}>{t('listing.owner.list.views.title', 'Vistas')}</h2>
                <fieldset
                    className={styles.toggle}
                    aria-label={t('common.window.ariaLabel', 'Período de tiempo')}
                >
                    <button
                        type="button"
                        className={windowParam === '7d' ? styles.toggleActive : styles.toggleButton}
                        onClick={() => setWindowParam('7d')}
                        aria-pressed={windowParam === '7d'}
                    >
                        {t('common.window.7d', '7 días')}
                    </button>
                    <button
                        type="button"
                        className={
                            windowParam === '30d' ? styles.toggleActive : styles.toggleButton
                        }
                        onClick={() => setWindowParam('30d')}
                        aria-pressed={windowParam === '30d'}
                    >
                        {t('common.window.30d', '30 días')}
                    </button>
                </fieldset>
            </div>

            {state.status === 'locked' && (
                <p
                    className={styles.locked}
                    data-testid="listing-views-locked"
                >
                    {t(
                        'listing.owner.list.views.locked',
                        'Las vistas de tus fichas aparecen mientras están publicadas, con un plan activo o en período de prueba.'
                    )}
                </p>
            )}

            {state.status === 'error' && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {t(
                        'listing.owner.list.views.error',
                        'No pudimos cargar las vistas. Probá de nuevo más tarde.'
                    )}
                </p>
            )}

            {state.status === 'ready' && (
                <ul
                    className={styles.list}
                    data-testid="listing-views-list"
                >
                    {state.rows.map((row) => (
                        <li
                            key={row.id}
                            className={styles.row}
                            data-testid="listing-views-row"
                        >
                            <span className={styles.rowName}>{row.name}</span>
                            <span className={styles.rowStats}>
                                <span data-testid="listing-views-unique">
                                    {row.unique} {t('listing.owner.list.views.unique', 'únicos')}
                                </span>
                                <span data-testid="listing-views-total">
                                    {row.total} {t('listing.owner.list.views.total', 'totales')}
                                </span>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
