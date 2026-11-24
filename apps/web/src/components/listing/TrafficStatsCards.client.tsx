/**
 * @file TrafficStatsCards.client.tsx
 * @description Owner-facing Umami traffic cards for ONE listing (HOS-2119):
 * where visitors come from (referrers), their countries, their devices and,
 * for accommodations only, the contact funnel.
 *
 * **Controlled window.** The parent owns the 7d/30d/90d selector and passes
 * `window`; this island refetches whenever it (or the listing) changes. It
 * builds no selector of its own.
 *
 * **Fail-soft.** Analytics are never worth an error banner: a failed request
 * and an invalid payload (checked with `ListingTrafficStatsResponseSchema`)
 * render nothing at all. `available: false` (the analytics provider is down,
 * HOS-2346) renders a neutral "unavailable" notice instead, so the owner sees
 * why the block is empty rather than a bare title.
 *
 * **Sentinels.** The API appends two computed referrer rows. `(direct)` and
 * `(internal)` are rendered with their i18n labels; real hosts are shown
 * verbatim. Counts everywhere are distinct visitors.
 *
 * Hydration: mount with `client:visible`, below the fold of the owner page.
 */

import { BarChartIcon } from '@repo/icons';
import {
    LISTING_TRAFFIC_DIRECT_REFERRER,
    LISTING_TRAFFIC_INTERNAL_REFERRER,
    type ListingContactFunnel,
    type ListingTrafficBreakdownItem,
    type ListingTrafficStatsEntityType,
    type ListingTrafficStatsResponse,
    ListingTrafficStatsResponseSchema,
    type ListingTrafficStatsWindow
} from '@repo/schemas';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/account/ui';
import { listingAnalyticsApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './TrafficStatsCards.module.css';

/** How many rows each breakdown card shows. */
const TOP_ROWS = 5;

/** Spanish fallbacks for the devices Umami reports that have a dedicated label. */
const KNOWN_DEVICE_FALLBACKS: Readonly<Record<string, string>> = {
    desktop: 'Computadora',
    laptop: 'Notebook',
    tablet: 'Tablet',
    mobile: 'Celular'
};

/** Key and Spanish fallback of the bucket that collects every unrecognised device. */
const OTHER_DEVICE_KEY = 'other';
const OTHER_DEVICE_FALLBACK = 'Otros';

/** One `Intl.DisplayNames` per locale (`null` when the runtime rejects the locale). */
const displayNamesCache = new Map<string, Intl.DisplayNames | null>();

/** Props of {@link TrafficStatsCards}. */
export interface TrafficStatsCardsProps {
    /** Locale used for copy and country names. */
    readonly locale: SupportedLocale;
    /** Listing type the stats belong to. */
    readonly entityType: ListingTrafficStatsEntityType;
    /** Listing id. */
    readonly entityId: string;
    /** Rolling window, controlled by the parent. */
    readonly window: ListingTrafficStatsWindow;
}

/** Validated payload, or nothing to show. */
type CardsState =
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly data: ListingTrafficStatsResponse }
    | { readonly status: 'unavailable' }
    | { readonly status: 'hidden' };

/**
 * Resolves a country name from its ISO 3166-1 alpha-2 code in `locale`.
 * Falls back to the raw code when the runtime does not know it.
 */
function countryName({ code, locale }: { code: string; locale: SupportedLocale }): string {
    let names = displayNamesCache.get(locale);
    if (names === undefined) {
        try {
            names = new Intl.DisplayNames([locale], { type: 'region' });
        } catch {
            names = null;
        }
        displayNamesCache.set(locale, names);
    }
    if (names === null) return code;
    try {
        return names.of(code.toUpperCase()) ?? code;
    } catch {
        return code;
    }
}

/** True when the funnel has at least one non-zero step. */
function hasFunnelData(funnel: ListingContactFunnel | null): funnel is ListingContactFunnel {
    return (
        funnel !== null &&
        (funnel.views > 0 || funnel.contactStarted > 0 || funnel.contactCompleted > 0)
    );
}

/**
 * Folds device rows into known devices plus ONE "other" row: every value that
 * is not a known device (case-insensitive) is summed into `other`. Sorted by
 * count, descending.
 */
function aggregateDevices(
    items: readonly ListingTrafficBreakdownItem[]
): readonly ListingTrafficBreakdownItem[] {
    const totals = new Map<string, number>();
    for (const item of items) {
        const lower = item.value.toLowerCase();
        const key = lower in KNOWN_DEVICE_FALLBACKS ? lower : OTHER_DEVICE_KEY;
        totals.set(key, (totals.get(key) ?? 0) + item.count);
    }
    return [...totals.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
}

interface BreakdownCardProps {
    readonly title: string;
    readonly emptyLabel: string;
    readonly rows: readonly {
        readonly key: string;
        readonly label: string;
        readonly count: number;
    }[];
    readonly countLabel: (count: number) => string;
    readonly testId: string;
}

/** One breakdown card: heading plus a list of `label — N visitors`. */
function BreakdownCard({
    title,
    emptyLabel,
    rows,
    countLabel,
    testId
}: BreakdownCardProps): JSX.Element {
    return (
        <section
            className={styles.card}
            data-testid={testId}
        >
            <h3 className={styles.cardTitle}>{title}</h3>
            {rows.length === 0 ? (
                <p className={styles.empty}>{emptyLabel}</p>
            ) : (
                <ul className={styles.list}>
                    {rows.map((row) => (
                        <li
                            key={row.key}
                            className={styles.row}
                        >
                            <span className={styles.rowLabel}>{row.label}</span>
                            <span className={styles.rowCount}>{countLabel(row.count)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

/** Maps rows to display rows with the given label resolver, capped at {@link TOP_ROWS}. */
function toRows({
    items,
    label
}: {
    items: readonly ListingTrafficBreakdownItem[];
    label: (value: string) => string;
}) {
    return items.slice(0, TOP_ROWS).map((item) => ({
        key: item.value,
        label: label(item.value),
        count: item.count
    }));
}

/**
 * TrafficStatsCards — referrers, countries, devices and (accommodations only)
 * contact funnel for one listing.
 *
 * @example
 * ```astro
 * <TrafficStatsCards client:visible locale={locale} entityType="ACCOMMODATION" entityId={id} window="30d" />
 * ```
 */
export function TrafficStatsCards({
    locale,
    entityType,
    entityId,
    window: windowParam
}: TrafficStatsCardsProps): JSX.Element | null {
    const { t, tPlural } = createTranslations(locale);
    const [state, setState] = useState<CardsState>({ status: 'loading' });

    useEffect(() => {
        let cancelled = false;
        setState({ status: 'loading' });

        const load = async (): Promise<CardsState> => {
            try {
                const result = await listingAnalyticsApi.getTrafficStats({
                    entityType,
                    entityId,
                    window: windowParam
                });
                if (!result.ok) return { status: 'hidden' };
                const parsed = ListingTrafficStatsResponseSchema.safeParse(result.data);
                if (!parsed.success) return { status: 'hidden' };
                if (!parsed.data.available) return { status: 'unavailable' };
                return { status: 'ready', data: parsed.data };
            } catch {
                return { status: 'hidden' };
            }
        };

        load().then((next) => {
            if (!cancelled) setState(next);
        });

        return () => {
            cancelled = true;
        };
    }, [entityType, entityId, windowParam]);

    if (state.status === 'hidden') return null;

    if (state.status === 'unavailable') {
        return (
            <p
                className={styles.unavailable}
                data-testid="traffic-stats-unavailable"
            >
                {t(
                    'listing.owner.traffic.unavailable',
                    'Estadísticas no disponibles en este momento. Intentá nuevamente más tarde.'
                )}
            </p>
        );
    }

    if (state.status === 'loading') {
        return (
            <div
                className={styles.loading}
                role="status"
                aria-busy="true"
                data-testid="traffic-stats-loading"
            >
                <span>{t('common.loading', 'Cargando...')}</span>
            </div>
        );
    }

    const { referrers, countries, devices, contactFunnel } = state.data;
    const emptyLabel = t('listing.owner.traffic.empty', 'Todavía no hay datos');
    const formatCount = (count: number): string => count.toLocaleString(locale);
    const funnel = hasFunnelData(contactFunnel) ? contactFunnel : null;

    if (
        referrers.length === 0 &&
        countries.length === 0 &&
        devices.length === 0 &&
        funnel === null
    ) {
        return (
            <div data-testid="traffic-stats-empty">
                <EmptyState
                    variant="compact"
                    icon={<BarChartIcon size={32} />}
                    title={emptyLabel}
                    description={t(
                        'listing.owner.traffic.emptyDescription',
                        'Cuando tus fichas reciban visitas, vas a ver acá de dónde vienen.'
                    )}
                />
            </div>
        );
    }

    // `tPlural` always interpolates the raw count, so swap in the localized one.
    const countLabel = (count: number): string => {
        const raw = tPlural('listing.owner.traffic.visitors', count, { count });
        return raw.replace(String(count), formatCount(count));
    };

    const referrerLabel = (value: string): string => {
        if (value === LISTING_TRAFFIC_DIRECT_REFERRER) {
            return t('listing.owner.traffic.referrers.direct', 'Directo');
        }
        if (value === LISTING_TRAFFIC_INTERNAL_REFERRER) {
            return t('listing.owner.traffic.referrers.internal', 'Desde Hospeda');
        }
        return value;
    };

    const deviceLabel = (value: string): string =>
        t(
            `listing.owner.traffic.devices.${value}`,
            KNOWN_DEVICE_FALLBACKS[value] ?? OTHER_DEVICE_FALLBACK
        );

    return (
        <div
            className={styles.grid}
            data-testid="traffic-stats-cards"
        >
            <BreakdownCard
                testId="traffic-card-referrers"
                title={t('listing.owner.traffic.referrers.title', 'De dónde vienen')}
                emptyLabel={emptyLabel}
                rows={toRows({ items: referrers, label: referrerLabel })}
                countLabel={countLabel}
            />
            <BreakdownCard
                testId="traffic-card-countries"
                title={t('listing.owner.traffic.countries.title', 'Países')}
                emptyLabel={emptyLabel}
                rows={toRows({
                    items: countries,
                    label: (code) => countryName({ code, locale })
                })}
                countLabel={countLabel}
            />
            <BreakdownCard
                testId="traffic-card-devices"
                title={t('listing.owner.traffic.devices.title', 'Dispositivos')}
                emptyLabel={emptyLabel}
                rows={toRows({ items: aggregateDevices(devices), label: deviceLabel })}
                countLabel={countLabel}
            />
            {contactFunnel !== null && (
                <section
                    className={styles.card}
                    data-testid="traffic-card-contacts"
                >
                    <h3 className={styles.cardTitle}>
                        {t('listing.owner.traffic.contacts.title', 'Contactos')}
                    </h3>
                    <dl className={styles.funnel}>
                        <div className={styles.row}>
                            <dt className={styles.rowLabel}>
                                {t('listing.owner.traffic.contacts.views', 'Vistas')}
                            </dt>
                            <dd className={styles.rowCount}>{formatCount(contactFunnel.views)}</dd>
                        </div>
                        <div className={styles.row}>
                            <dt className={styles.rowLabel}>
                                {t('listing.owner.traffic.contacts.started', 'Contacto iniciado')}
                            </dt>
                            <dd className={styles.rowCount}>
                                {formatCount(contactFunnel.contactStarted)}
                            </dd>
                        </div>
                        <div className={styles.row}>
                            <dt className={styles.rowLabel}>
                                {t(
                                    'listing.owner.traffic.contacts.completed',
                                    'Contacto completado'
                                )}
                            </dt>
                            <dd className={styles.rowCount}>
                                {formatCount(contactFunnel.contactCompleted)}
                            </dd>
                        </div>
                    </dl>
                </section>
            )}
        </div>
    );
}
