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

import { EntityTypeEnum, type ListingTrafficStatsEntityType } from '@repo/schemas';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { listingAnalyticsApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';
import styles from './ListingViewsWidget.module.css';
import { TrafficStatsCards } from './TrafficStatsCards.client';

/** Verticals that get their own traffic section, in display order. */
const TRAFFIC_VERTICALS: readonly VenueOrExperience[] = ['venue', 'experience'];

/** Traffic-stats entity type for each owner vertical. */
const TRAFFIC_ENTITY_TYPE: Readonly<Record<VenueOrExperience, ListingTrafficStatsEntityType>> = {
    venue: EntityTypeEnum.VENUE,
    experience: EntityTypeEnum.EXPERIENCE
};

/** Minimal listing shape the widget needs — id, vertical, and display name. */
export interface ListingViewsWidgetListing {
    readonly id: string;
    readonly vertical: VenueOrExperience;
    readonly name: string;
    /**
     * `true` for a `PURGED` listing (HOS-1492 keeps it in the views list on
     * purpose). A purged listing offers no traffic section: nothing to measure.
     */
    readonly purged?: boolean;
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

/**
 * `ready` carries the rows of every vertical that answered AND whether some
 * vertical was locked: one vertical refusing must not hide another's data.
 */
type WidgetState =
    | { readonly status: 'loading' }
    | {
          readonly status: 'ready';
          readonly rows: readonly ViewRow[];
          readonly hasLockedVertical: boolean;
          /** Verticals the API refused with `ENTITLEMENT_REQUIRED` (no traffic cards for them). */
          readonly lockedVerticals: readonly VenueOrExperience[];
      }
    | { readonly status: 'error' };

/** What {@link fetchRows} resolves to: rows plus the locked flag, or a genuine failure. */
type FetchOutcome =
    | {
          readonly ok: true;
          readonly rows: readonly ViewRow[];
          readonly hasLockedVertical: boolean;
          readonly lockedVerticals: readonly VenueOrExperience[];
      }
    | { readonly ok: false };

/**
 * Fetches view stats for every distinct vertical present in `listings` and
 * zips the results with each listing's display name.
 *
 * A vertical refused with `403 ENTITLEMENT_REQUIRED` contributes no rows and
 * sets `hasLockedVertical`; the other verticals' rows still render. Any other
 * failure is a genuine error for the whole widget.
 */
async function fetchRows(
    listings: readonly ListingViewsWidgetListing[],
    windowParam: '7d' | '30d'
): Promise<FetchOutcome> {
    const verticals = [...new Set(listings.map((l) => l.vertical))];
    const nameById = new Map(listings.map((l) => [l.id, l.name] as const));

    const results = await Promise.all(
        verticals.map((vertical) => listingAnalyticsApi.getViews({ vertical, window: windowParam }))
    );

    let hasLockedVertical = false;
    const lockedVerticals: VenueOrExperience[] = [];
    const rows: ViewRow[] = [];
    for (const [index, result] of results.entries()) {
        if (!result.ok) {
            if (result.error.status === 403 && result.error.code === 'ENTITLEMENT_REQUIRED') {
                hasLockedVertical = true;
                const lockedVertical = verticals[index];
                if (lockedVertical !== undefined) lockedVerticals.push(lockedVertical);
                continue;
            }
            return { ok: false };
        }
        for (const item of result.data) {
            rows.push({
                id: item.entityId,
                name: nameById.get(item.entityId) ?? item.entityId,
                unique: item.unique,
                total: item.total
            });
        }
    }
    return { ok: true, rows, hasLockedVertical, lockedVerticals };
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
    /**
     * Verticals refused with `ENTITLEMENT_REQUIRED`, or `null` while unknown or
     * after a genuine failure. Kept apart from `state` and updated ONLY when a
     * read settles: deriving it from `state.status` would empty the traffic
     * sections on every window toggle (status goes back to `loading`), unmounting
     * the islands instead of handing them the new `window` prop.
     */
    const [lockedVerticals, setLockedVerticals] = useState<readonly VenueOrExperience[] | null>(
        null
    );

    useEffect(() => {
        let cancelled = false;

        if (listings.length === 0) {
            setState({
                status: 'ready',
                rows: [],
                hasLockedVertical: false,
                lockedVerticals: []
            });
            setLockedVerticals([]);
            return;
        }

        setState({ status: 'loading' });
        fetchRows(listings, windowParam).then((outcome) => {
            if (cancelled) return;
            setLockedVerticals(outcome.ok ? outcome.lockedVerticals : null);
            setState(
                outcome.ok
                    ? {
                          status: 'ready',
                          rows: outcome.rows,
                          hasLockedVertical: outcome.hasLockedVertical,
                          lockedVerticals: outcome.lockedVerticals
                      }
                    : { status: 'error' }
            );
        });

        return () => {
            cancelled = true;
        };
    }, [listings, windowParam]);

    if (listings.length === 0) {
        return null;
    }

    // HOS-2119: Umami traffic cards per listing whose vertical answered the
    // views read. A locked vertical (no tier) gets none: the island would only
    // spend a request to be refused. A PURGED listing gets none either. The set
    // survives a window toggle (see `lockedVerticals`), so islands stay mounted.
    const trafficListings =
        lockedVerticals === null
            ? []
            : listings.filter(
                  (listing) => !listing.purged && !lockedVerticals.includes(listing.vertical)
              );

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

            {state.status === 'ready' && state.hasLockedVertical && (
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

            {state.status === 'ready' && state.rows.length > 0 && (
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

            {TRAFFIC_VERTICALS.map((vertical) => {
                const verticalListings = trafficListings.filter(
                    (listing) => listing.vertical === vertical
                );
                if (verticalListings.length === 0) return null;
                return (
                    <section
                        key={vertical}
                        className={styles.traffic}
                        data-testid={`listing-traffic-section-${vertical}`}
                    >
                        <h2 className={styles.title}>
                            {t('listing.owner.traffic.verticalTitle', 'Tráfico: {{vertical}}', {
                                vertical: t(
                                    `listing.owner.list.badge.${vertical}`,
                                    vertical === 'venue' ? 'Comer y salir' : 'Experiencia'
                                )
                            })}
                        </h2>
                        {verticalListings.map((listing) => (
                            <section
                                key={listing.id}
                                className={styles.trafficListing}
                                aria-labelledby={`listing-traffic-name-${listing.id}`}
                                data-testid="listing-traffic-listing"
                            >
                                <p
                                    id={`listing-traffic-name-${listing.id}`}
                                    className={styles.trafficListingName}
                                >
                                    {listing.name}
                                </p>
                                <TrafficStatsCards
                                    locale={locale}
                                    entityType={TRAFFIC_ENTITY_TYPE[vertical]}
                                    entityId={listing.id}
                                    window={windowParam}
                                />
                            </section>
                        ))}
                    </section>
                );
            })}
        </div>
    );
}
