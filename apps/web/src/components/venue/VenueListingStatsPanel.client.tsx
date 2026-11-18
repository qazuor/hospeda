/** Owner-only advanced venue listing metrics panel (HOS-2261). */

import { type JSX, useEffect, useState } from 'react';
import { listingAnalyticsApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { buildUrl } from '@/lib/urls';
import styles from './VenueListingStatsPanel.module.css';

/** Venue selector option passed from the owner-only Astro page. */
export interface VenueListingStatsPanelListing {
    readonly id: string;
    readonly name: string;
}

/** Props for the venue metrics island. */
export interface VenueListingStatsPanelProps {
    readonly locale: SupportedLocale;
    readonly listings: readonly VenueListingStatsPanelListing[];
    /** First venue plan in catalog order that grants advanced statistics. */
    readonly unlockingPlanName: string | null;
}

type WindowValue = '7d' | '30d' | '90d';
type StatsResult = Awaited<ReturnType<typeof listingAnalyticsApi.getVenueStats>>;
type PanelState =
    | { readonly status: 'loading' }
    | { readonly status: 'locked' }
    | { readonly status: 'error' }
    | {
          readonly status: 'ready';
          readonly stats: NonNullable<Extract<StatsResult, { ok: true }>['data']>;
      };

const WINDOWS: readonly WindowValue[] = ['7d', '30d', '90d'];
const CHANNELS = [
    ['PHONE_CLICK', 'phone'],
    ['MAP_CLICK', 'map'],
    ['WEBSITE_CLICK', 'website'],
    ['INSTAGRAM_CLICK', 'instagram'],
    ['TICKET_CLICK', 'tickets'],
    ['WHATSAPP_CLICK', 'whatsapp']
] as const;

/** Checks the stable entitlement error shape returned by protected listing gates. */
function isAdvancedStatsEntitlementError(error: {
    readonly status: number;
    readonly code?: string;
    readonly details?: unknown;
}): boolean {
    if (error.status !== 403 || error.code !== 'ENTITLEMENT_REQUIRED') return false;
    if (typeof error.details !== 'object' || error.details === null) return false;
    return (
        'entitlementKey' in error.details && error.details.entitlementKey === 'view_advanced_stats'
    );
}

/** Renders gap-filled daily views as a compact bar list. */
function DailyViews({
    items
}: {
    readonly items: readonly { readonly date: string; readonly total: number }[];
}): JSX.Element {
    const max = Math.max(1, ...items.map((item) => item.total));
    return (
        <ul
            className={styles.series}
            data-testid="venue-stats-daily-views"
        >
            {items.map((item) => (
                <li
                    key={item.date}
                    className={styles.seriesRow}
                >
                    <time
                        className={styles.seriesDate}
                        dateTime={item.date}
                    >
                        {item.date.slice(5)}
                    </time>
                    <span className={styles.seriesTrack}>
                        <span
                            className={styles.seriesBar}
                            style={{ width: `${Math.round((item.total / max) * 100)}%` }}
                        />
                    </span>
                    <span className={styles.seriesValue}>{item.total}</span>
                </li>
            ))}
        </ul>
    );
}

/**
 * Displays advanced metrics for one venue at a time. An empty listing array
 * returns before any request or client-visible content is produced.
 */
export function VenueListingStatsPanel({
    locale,
    listings,
    unlockingPlanName
}: VenueListingStatsPanelProps): JSX.Element | null {
    const { t, tPlural } = createTranslations(locale);
    const [selectedId, setSelectedId] = useState(listings[0]?.id ?? '');
    const [windowValue, setWindowValue] = useState<WindowValue>('30d');
    const [state, setState] = useState<PanelState>({ status: 'loading' });
    useEffect(() => {
        if (!selectedId || unlockingPlanName === null) return;
        let cancelled = false;
        setState({ status: 'loading' });
        void (async () => {
            const result = await listingAnalyticsApi.getVenueStats({
                id: selectedId,
                window: windowValue
            });
            if (cancelled) return;
            if (result.ok) {
                setState({ status: 'ready', stats: result.data });
            } else if (isAdvancedStatsEntitlementError(result.error)) {
                setState({ status: 'locked' });
            } else {
                setState({ status: 'error' });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedId, unlockingPlanName, windowValue]);

    if (listings.length === 0 || unlockingPlanName === null) return null;
    const lockedNoticeVisible = state.status === 'locked';
    const history = tPlural('listing.owner.list.venueStats.historyDays', 90);

    return (
        <section
            className={styles.panel}
            data-testid="venue-listing-stats-panel"
        >
            <header className={styles.header}>
                <div>
                    <h2 className={styles.title}>
                        {t('listing.owner.list.venueStats.title', 'Métricas de tu ficha')}
                    </h2>
                    {listings.length > 1 && (
                        <label className={styles.selectorLabel}>
                            {t('listing.owner.list.venueStats.venue', 'Local')}
                            <select
                                value={selectedId}
                                onChange={(event) => setSelectedId(event.currentTarget.value)}
                            >
                                {listings.map((listing) => (
                                    <option
                                        key={listing.id}
                                        value={listing.id}
                                    >
                                        {listing.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                </div>
                <fieldset
                    className={styles.toggle}
                    aria-label={t('common.window.ariaLabel', 'Período de tiempo')}
                >
                    {WINDOWS.map((value) => (
                        <button
                            key={value}
                            type="button"
                            className={
                                windowValue === value ? styles.toggleActive : styles.toggleButton
                            }
                            onClick={() => setWindowValue(value)}
                            aria-pressed={windowValue === value}
                        >
                            {t(
                                `common.window.${value}`,
                                value === '90d' ? '90 días' : value === '30d' ? '30 días' : '7 días'
                            )}
                        </button>
                    ))}
                </fieldset>
            </header>

            {state.status === 'loading' && (
                <p
                    className={styles.muted}
                    role="status"
                >
                    {t('listing.owner.list.venueStats.loading', 'Cargando métricas…')}
                </p>
            )}
            {state.status === 'error' && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {t(
                        'listing.owner.list.venueStats.error',
                        'No pudimos cargar las métricas. Probá de nuevo más tarde.'
                    )}
                </p>
            )}
            {lockedNoticeVisible && (
                <div
                    className={styles.locked}
                    data-testid="venue-stats-upgrade-notice"
                >
                    <p>
                        {t(
                            'listing.owner.list.venueStats.lockedWithPlan',
                            'Desbloqueá el gráfico diario, los clics por canal, la tasa de clics y {{history}} de datos con {{plan}}.',
                            { history, plan: unlockingPlanName }
                        )}
                    </p>
                    <a href={buildUrl({ locale, path: PRICING_PAGE_PATH_BY_AUDIENCE.venue })}>
                        {t('listing.owner.list.venueStats.seePlans', 'Ver planes')}
                    </a>
                </div>
            )}
            {state.status === 'ready' && (
                <>
                    <div className={styles.summary}>
                        <div>
                            <strong>{state.stats.views.total}</strong>
                            <span>{t('listing.owner.list.venueStats.views', 'visitas')}</span>
                        </div>
                        <div>
                            <strong>{state.stats.clicks.total}</strong>
                            <span>
                                {t('listing.owner.list.venueStats.clicks', 'clics de contacto')}
                            </span>
                        </div>
                        <div>
                            <strong>
                                {state.stats.clickRate === null
                                    ? '—'
                                    : `${Math.round(state.stats.clickRate * 100)}%`}
                            </strong>
                            <span>
                                {t('listing.owner.list.venueStats.clickRate', 'tasa de clics')}
                            </span>
                            <small>
                                {t(
                                    'listing.owner.list.venueStats.clickRateHelp',
                                    'De cada 100 visitas, cuántas tocaron algún contacto.'
                                )}
                            </small>
                        </div>
                    </div>
                    {state.stats.views.total === 0 ? (
                        <p className={styles.muted}>
                            {t(
                                'listing.owner.list.venueStats.empty',
                                'Todavía no hay visitas en este período.'
                            )}
                        </p>
                    ) : (
                        <DailyViews items={state.stats.dailyViews} />
                    )}
                    <ul className={styles.channels}>
                        {CHANNELS.map(([kind, label]) => (
                            <li key={kind}>
                                <span>
                                    {t(`listing.owner.list.venueStats.channel.${label}`, label)}
                                </span>
                                <strong>{state.stats.clicks.byKind[kind].total}</strong>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </section>
    );
}
