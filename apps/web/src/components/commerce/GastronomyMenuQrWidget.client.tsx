/**
 * @file GastronomyMenuQrWidget.client.tsx
 * @description Owner panel for the gastronomy menu QR and its scan analytics
 * (HOS-1044 §6.6), rendered in `mi-cuenta/comercio/` next to
 * `CommerceViewsWidget`.
 *
 * Follows that same widget's pattern rather than inventing a new one:
 * `client:visible`, a `loading`/`ready`/`error` state machine, its own
 * `*.module.css`. It adds one state CommerceViewsWidget does not need —
 * `locked` — because unlike `VIEW_BASIC_STATS` (the commerce floor every
 * tier gets), `menu_qr_analytics` is a premium-only entitlement
 * (`gastronomy-premium`), so a basic/pro venue's request answers `403`. That
 * refusal is a REAL state, never rendered as a generic error: the copy names
 * the plan gate, mirroring `BrochureDownloadButton.client.tsx` /
 * `ExperienceCertificatePanel.client.tsx`'s own `locked` branch.
 *
 * ## What this panel must never say (HOS-1141, NG-3/NG-4)
 *
 * No country, no location, no "where from" — none of that is recorded. A
 * table QR is scanned from inside the venue, so a country column would read
 * "Argentina" almost always, including for the tourists the metric exists to
 * count; and a camera scan opens the URL directly with no `Referer` header,
 * so "where from" cannot even be captured. Only **device** and **language**
 * are shown, named as such — language is the honest proxy for "where the
 * diner is from" HOS-1141 chose instead.
 *
 * ## Nulls are the normal case, not a bug
 *
 * The redirect records a scan best-effort — a garbage or absent user-agent
 * still counts, with `deviceType`/`os`/`browserLanguage` left `null`. The API
 * groups those under the literal key `'unknown'` (never drops them, so every
 * breakdown's values still sum to `total`), and this panel renders that
 * bucket with a proper label, not the raw string.
 *
 * @module components/commerce/GastronomyMenuQrWidget
 */

import { type JSX, useEffect, useState } from 'react';
import { commerceAnalyticsApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations, type TranslationFn } from '@/lib/i18n';
import { buildSvgDataUrl, renderSvgToPngBlob } from '@/lib/qr/qr-png';
import styles from './GastronomyMenuQrWidget.module.css';

/** The one gastronomy listing shape this widget needs. */
export interface GastronomyMenuQrWidgetListing {
    readonly id: string;
    readonly name: string;
}

export interface GastronomyMenuQrWidgetProps {
    readonly locale: SupportedLocale;
    /** The owner's gastronomy listings only — the menu QR is gastronomy-specific. */
    readonly listings: readonly GastronomyMenuQrWidgetListing[];
}

/** The QR itself, as `commerceAnalyticsApi.getMenuQr` returns it. */
interface MenuQrData {
    readonly svg: string;
    readonly targetUrl: string;
    readonly qrSlug: string;
}

/** One day of the gap-filled daily series. */
interface MenuQrSeriesItem {
    readonly date: string;
    readonly total: number;
}

/** The scan aggregate, as `commerceAnalyticsApi.getMenuQrScans` returns it. */
interface MenuQrScanStats {
    readonly total: number;
    readonly dailySeries: readonly MenuQrSeriesItem[];
    readonly byDeviceType: Readonly<Record<string, number>>;
    readonly byOs: Readonly<Record<string, number>>;
    readonly byBrowserLanguage: Readonly<Record<string, number>>;
}

/** Per-listing widget state. */
type ListingQrState =
    | { readonly status: 'loading' }
    | { readonly status: 'locked' }
    | { readonly status: 'error' }
    | { readonly status: 'ready'; readonly qr: MenuQrData; readonly stats: MenuQrScanStats };

/**
 * Fetches one listing's QR and scan aggregate together. A `403` on EITHER
 * call means the panel renders the locked state — both endpoints share the
 * same `menu_qr_analytics` gate, so they refuse identically.
 */
async function fetchListingState(
    listingId: string,
    windowParam: '7d' | '30d'
): Promise<ListingQrState> {
    const [qrResult, scansResult] = await Promise.all([
        commerceAnalyticsApi.getMenuQr({ gastronomyId: listingId }),
        commerceAnalyticsApi.getMenuQrScans({ gastronomyId: listingId, window: windowParam })
    ]);

    if (!qrResult.ok || !scansResult.ok) {
        const isLocked =
            (!qrResult.ok && qrResult.error.status === 403) ||
            (!scansResult.ok && scansResult.error.status === 403);
        return { status: isLocked ? 'locked' : 'error' };
    }

    return { status: 'ready', qr: qrResult.data, stats: scansResult.data };
}

/** Renders the gap-filled daily series as a compact horizontal bar list. */
function DailySeries({
    items
}: {
    readonly items: readonly MenuQrSeriesItem[];
}): JSX.Element | null {
    if (items.length === 0) {
        return null;
    }
    const max = Math.max(1, ...items.map((item) => item.total));

    return (
        <ul
            className={styles.series}
            data-testid="menu-qr-daily-series"
        >
            {items.map((item) => (
                <li
                    key={item.date}
                    className={styles.seriesRow}
                >
                    <span className={styles.seriesDate}>{item.date.slice(5)}</span>
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
 * Renders one breakdown (device, OS or language) as a label/count list,
 * sorted by count descending. The literal key `'unknown'` — the redirect's
 * best-effort NORMAL case, not an error — gets the translated "unknown"
 * label instead of the raw string; every other key (an actual observed
 * device/OS/language value) is shown as-is.
 */
function Breakdown({
    title,
    breakdown,
    t
}: {
    readonly title: string;
    readonly breakdown: Readonly<Record<string, number>>;
    readonly t: TranslationFn;
}): JSX.Element | null {
    const entries = Object.entries(breakdown).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    );
    if (entries.length === 0) {
        return null;
    }

    return (
        <div className={styles.breakdown}>
            <h4 className={styles.breakdownTitle}>{title}</h4>
            <ul className={styles.breakdownList}>
                {entries.map(([key, count]) => (
                    <li
                        key={key}
                        className={styles.breakdownRow}
                    >
                        <span>
                            {key === 'unknown'
                                ? t('commerce.owner.list.menuQr.unknown', 'Desconocido')
                                : key}
                        </span>
                        <span className={styles.breakdownValue}>{count}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** Renders the QR image plus a "download as PNG" button for one listing. */
function QrBlock({
    listingName,
    qr,
    t
}: {
    readonly listingName: string;
    readonly qr: MenuQrData;
    readonly t: TranslationFn;
}): JSX.Element {
    const [downloaded, setDownloaded] = useState(false);

    async function handleDownload(): Promise<void> {
        const blob = await renderSvgToPngBlob({ svg: qr.svg });
        const anchor = document.createElement('a');
        if (blob) {
            const objectUrl = URL.createObjectURL(blob);
            anchor.href = objectUrl;
            anchor.download = `qr-carta-${qr.qrSlug}.png`;
            anchor.click();
            // Freed on the next tick — revoking before the browser has
            // started the save aborts it in Safari (same fix already applied
            // in `BrochureDownloadButton.client.tsx`).
            setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
        } else {
            // PNG conversion is an enhancement, not a requirement (see
            // `qr-png.ts`) — a browser that cannot run it still gets a
            // working download, just as SVG instead.
            anchor.href = buildSvgDataUrl(qr.svg);
            anchor.download = `qr-carta-${qr.qrSlug}.svg`;
            anchor.click();
        }
        setDownloaded(true);
    }

    return (
        <div className={styles.qrBlock}>
            <img
                className={styles.qrImage}
                alt={t(
                    'commerce.owner.list.menuQr.qrAlt',
                    'Código QR que lleva a la carta de {{name}}',
                    {
                        name: listingName
                    }
                )}
                src={buildSvgDataUrl(qr.svg)}
            />
            <p className={styles.qrTarget}>
                {t('commerce.owner.list.menuQr.encodes', 'Lleva a: {{url}}', { url: qr.targetUrl })}
            </p>
            <button
                type="button"
                className={styles.downloadButton}
                onClick={() => {
                    void handleDownload();
                }}
                data-testid="menu-qr-download"
            >
                {t('commerce.owner.list.menuQr.download', 'Descargar QR (PNG)')}
            </button>
            {downloaded && (
                <p
                    className={styles.downloaded}
                    role="status"
                >
                    {t('commerce.owner.list.menuQr.downloaded', 'Listo, lo descargamos.')}
                </p>
            )}
        </div>
    );
}

/**
 * GastronomyMenuQrWidget — per-listing menu QR + scan analytics for
 * gastronomy owners, gated by the `menu_qr_analytics` entitlement.
 *
 * @example
 * ```astro
 * <GastronomyMenuQrWidget client:visible locale={locale} listings={gastronomyListings} />
 * ```
 */
export function GastronomyMenuQrWidget({
    locale,
    listings
}: GastronomyMenuQrWidgetProps): JSX.Element | null {
    const { t } = createTranslations(locale);
    const [windowParam, setWindowParam] = useState<'7d' | '30d'>('30d');
    const [states, setStates] = useState<ReadonlyMap<string, ListingQrState>>(new Map());

    useEffect(() => {
        let cancelled = false;

        if (listings.length === 0) {
            return;
        }

        setStates(
            new Map(
                listings.map((listing) => [listing.id, { status: 'loading' } as ListingQrState])
            )
        );

        Promise.all(
            listings.map(
                async (listing) =>
                    [listing.id, await fetchListingState(listing.id, windowParam)] as const
            )
        ).then((results) => {
            if (cancelled) return;
            setStates(new Map(results));
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
            data-testid="gastronomy-menu-qr-widget"
        >
            <div className={styles.header}>
                <h2 className={styles.title}>
                    {t('commerce.owner.list.menuQr.title', 'QR de la carta')}
                </h2>
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

            {listings.map((listing) => {
                const state = states.get(listing.id) ?? { status: 'loading' as const };

                return (
                    <div
                        key={listing.id}
                        className={styles.card}
                        data-testid="gastronomy-menu-qr-card"
                    >
                        <h3 className={styles.cardName}>{listing.name}</h3>

                        {state.status === 'locked' && (
                            <p
                                className={styles.locked}
                                data-testid="gastronomy-menu-qr-locked"
                            >
                                {t(
                                    'commerce.owner.list.menuQr.locked',
                                    'El QR de la carta y sus estadísticas de escaneo están disponibles en el plan Premium de gastronomía.'
                                )}
                            </p>
                        )}

                        {state.status === 'error' && (
                            <p
                                className={styles.error}
                                role="alert"
                            >
                                {t(
                                    'commerce.owner.list.menuQr.error',
                                    'No pudimos cargar los escaneos del QR. Probá de nuevo más tarde.'
                                )}
                            </p>
                        )}

                        {state.status === 'ready' && (
                            <>
                                <div className={styles.totalRow}>
                                    <span
                                        className={styles.totalNumber}
                                        data-testid="menu-qr-total"
                                    >
                                        {state.stats.total}
                                    </span>
                                    <span className={styles.totalLabel}>
                                        {t('commerce.owner.list.menuQr.scans', 'escaneos')}
                                    </span>
                                </div>

                                {state.stats.total === 0 ? (
                                    <p className={styles.empty}>
                                        {t(
                                            'commerce.owner.list.menuQr.empty',
                                            'Todavía no tuvo escaneos en este período.'
                                        )}
                                    </p>
                                ) : (
                                    <DailySeries items={state.stats.dailySeries} />
                                )}

                                <div className={styles.breakdowns}>
                                    <Breakdown
                                        title={t(
                                            'commerce.owner.list.menuQr.device',
                                            'Dispositivo'
                                        )}
                                        breakdown={state.stats.byDeviceType}
                                        t={t}
                                    />
                                    <Breakdown
                                        title={t(
                                            'commerce.owner.list.menuQr.os',
                                            'Sistema operativo'
                                        )}
                                        breakdown={state.stats.byOs}
                                        t={t}
                                    />
                                    <Breakdown
                                        title={t('commerce.owner.list.menuQr.language', 'Idioma')}
                                        breakdown={state.stats.byBrowserLanguage}
                                        t={t}
                                    />
                                </div>

                                <QrBlock
                                    listingName={listing.name}
                                    qr={state.qr}
                                    t={t}
                                />
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
