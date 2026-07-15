/**
 * @file CalendarSyncPanel.client.tsx
 * @description Multi-provider external calendar connect/disconnect panel for
 * the occupancy calendar section (HOS-157 Phase 2 — Google Calendar; widened
 * HOS-162 Phase 3 — Layer F — to Airbnb / Booking.com / generic iCal feeds).
 *
 * Rendered at the top of `CalendarSection`, gated by the
 * `can_sync_external_calendar` entitlement. One row per provider
 * (`CalendarProviderRow.client.tsx`) lets a host:
 * - connect their Google Calendar (full-page OAuth round-trip) or an Airbnb/
 *   Booking.com/generic `.ics` feed (inline, no redirect),
 * - see each connection's last-sync health,
 * - trigger an on-demand sync per provider,
 * - disconnect per provider.
 *
 * Each provider's connect/sync/disconnect state is independent — syncing one
 * provider never disables the others' actions.
 *
 * The Google connect flow navigates the browser to Google's consent screen
 * and, after the API callback, returns here with a
 * `?calendarSync=connected|error` flag this panel reads on mount to show a
 * result banner (then cleans the URL). This part is Google-specific — iCal
 * providers connect inline via `connect-ical`, no redirect involved.
 *
 * The panel's root carries `id="calendar-sync"` so the broken-feed
 * notification email (which links to `.../editar#calendar-sync`) has a
 * scroll target; a mount-time effect also `scrollIntoView`s it when the URL
 * already has that hash on load (the browser's native anchor scroll can miss
 * a client-rendered island if it hydrates after the initial scroll attempt).
 *
 * @module components/host/editor/CalendarSyncPanel
 */

import { OccupancySourceEnum } from '@repo/schemas';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
    CalendarProviderConnectionStatus,
    CalendarProviderToken
} from '@/lib/api/endpoints-protected';
import { accommodationCalendarSyncApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { CalendarProviderRow, type ProviderRowBusy } from './CalendarProviderRow.client';
import styles from './CalendarSyncPanel.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for CalendarSyncPanel. */
export interface CalendarSyncPanelProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
}

type Banner = { readonly kind: 'success' | 'error' | 'info'; readonly message: string };

/** A row-level result message — never `'error'` (those go through `rowError` instead). */
type RowInfoMessage = { readonly kind: 'success' | 'info'; readonly message: string };

/** Every provider this panel renders a row for, in display order. */
const PROVIDERS: readonly OccupancySourceEnum[] = [
    OccupancySourceEnum.GOOGLE_CALENDAR,
    OccupancySourceEnum.AIRBNB,
    OccupancySourceEnum.BOOKING,
    OccupancySourceEnum.OTHER
];

/** Maps an internal `OccupancySourceEnum` provider to the public API token. */
const PROVIDER_TOKEN: Record<OccupancySourceEnum, CalendarProviderToken> = {
    [OccupancySourceEnum.GOOGLE_CALENDAR]: 'google',
    [OccupancySourceEnum.AIRBNB]: 'airbnb',
    [OccupancySourceEnum.BOOKING]: 'booking',
    [OccupancySourceEnum.OTHER]: 'other',
    [OccupancySourceEnum.MANUAL]: 'google' // never dispatched — MANUAL has no connection row
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * External calendar connect/sync/disconnect panel — one row per provider.
 */
export function CalendarSyncPanel({ locale, accommodationId }: CalendarSyncPanelProps) {
    // Memoize so `t` keeps a stable identity across renders. The mount effect
    // below depends on `t`; without this, `createTranslations` returns a fresh
    // `t` every render, re-running the effect → re-fetching status → infinite
    // render/fetch loop that hammers the API into a 429 (matches the
    // SearchHistoryList island pattern).
    const { t } = useMemo(() => createTranslations(locale), [locale]);

    const [isLoading, setIsLoading] = useState(true);
    const [connections, setConnections] = useState<
        Partial<Record<OccupancySourceEnum, CalendarProviderConnectionStatus>>
    >({});
    const [oauthBanner, setOauthBanner] = useState<Banner | null>(null);

    const [rowBusy, setRowBusy] = useState<Partial<Record<OccupancySourceEnum, ProviderRowBusy>>>(
        {}
    );
    const [rowError, setRowError] = useState<Partial<Record<OccupancySourceEnum, string | null>>>(
        {}
    );
    const [rowInfo, setRowInfo] = useState<
        Partial<Record<OccupancySourceEnum, RowInfoMessage | null>>
    >({});

    const panelRef = useRef<HTMLElement>(null);

    // --- Scroll to this panel when the URL already carries #calendar-sync
    // (e.g. arriving from the broken-feed notification email link) ---
    useEffect(() => {
        if (typeof window === 'undefined') return;
        // Optional chain on the method itself, not just the ref — jsdom (test
        // environment) does not implement `scrollIntoView`.
        if (window.location.hash === '#calendar-sync') {
            panelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    // --- Fetch connection status for every provider ---
    const refreshStatus = useCallback(async () => {
        const result = await accommodationCalendarSyncApi.status({ id: accommodationId });
        if (!result.ok) {
            webLogger.warn('[CalendarSyncPanel] status failed:', result.error);
            setConnections({});
            return;
        }
        const next: Partial<Record<OccupancySourceEnum, CalendarProviderConnectionStatus>> = {};
        for (const row of result.data.connections) {
            next[row.provider] = row;
        }
        setConnections(next);
    }, [accommodationId]);

    // --- On mount: read the OAuth callback result flag, then load status ---
    useEffect(() => {
        // Read + clear the ?calendarSync result flag left by the Google OAuth callback.
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const flag = params.get('calendarSync');
            if (flag === 'connected') {
                setOauthBanner({
                    kind: 'success',
                    message: t(
                        'host.properties.editor.calendarSync.connectedBanner',
                        'Tu Google Calendar quedó conectado. Ya vamos a sincronizar tus fechas ocupadas.'
                    )
                });
            } else if (flag === 'error') {
                setOauthBanner({
                    kind: 'error',
                    message: t(
                        'host.properties.editor.calendarSync.connectErrorBanner',
                        'No pudimos conectar tu Google Calendar. Probá de nuevo.'
                    )
                });
            }
            if (flag) {
                params.delete('calendarSync');
                params.delete('accommodationId');
                const query = params.toString();
                window.history.replaceState(
                    null,
                    '',
                    `${window.location.pathname}${query ? `?${query}` : ''}`
                );
            }
        }

        let cancelled = false;
        setIsLoading(true);
        refreshStatus().finally(() => {
            if (!cancelled) setIsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [refreshStatus, t]);

    // --- Connect (Google): full-page navigate to Google's consent screen ---
    const handleConnectGoogle = useCallback(async () => {
        const provider = OccupancySourceEnum.GOOGLE_CALENDAR;
        setRowBusy((prev) => ({ ...prev, [provider]: 'connecting' }));
        setRowError((prev) => ({ ...prev, [provider]: null }));
        setRowInfo((prev) => ({ ...prev, [provider]: null }));
        const returnTo = typeof window === 'undefined' ? undefined : window.location.pathname;
        const result = await accommodationCalendarSyncApi.connectGoogle({
            id: accommodationId,
            ...(returnTo ? { returnTo } : {})
        });
        if (result.ok && result.data.authorizeUrl) {
            window.location.href = result.data.authorizeUrl;
            return;
        }
        webLogger.warn('[CalendarSyncPanel] connect failed:', result.ok ? 'no url' : result.error);
        setRowError((prev) => ({
            ...prev,
            [provider]: t(
                'host.properties.editor.calendarSync.connectErrorBanner',
                'No pudimos conectar tu Google Calendar. Probá de nuevo.'
            )
        }));
        setRowBusy((prev) => ({ ...prev, [provider]: null }));
    }, [accommodationId, t]);

    // --- Connect (iCal): inline, no redirect ---
    const handleConnectIcal = useCallback(
        async (provider: OccupancySourceEnum, feedUrl: string) => {
            const token = PROVIDER_TOKEN[provider];
            if (token === 'google') return; // defensive — never called for Google
            setRowBusy((prev) => ({ ...prev, [provider]: 'connecting' }));
            setRowError((prev) => ({ ...prev, [provider]: null }));
            setRowInfo((prev) => ({ ...prev, [provider]: null }));

            const result = await accommodationCalendarSyncApi.connectIcal({
                id: accommodationId,
                provider: token,
                feedUrl
            });

            if (result.ok) {
                await refreshStatus();
            } else {
                setRowError((prev) => ({
                    ...prev,
                    [provider]:
                        result.error.message ||
                        t(
                            'host.properties.editor.calendarSync.connectIcalError',
                            'No pudimos conectar ese calendario. Revisá la URL e intentá de nuevo.'
                        )
                }));
            }
            setRowBusy((prev) => ({ ...prev, [provider]: null }));
        },
        [accommodationId, refreshStatus, t]
    );

    // --- Sync now ---
    const handleSync = useCallback(
        async (provider: OccupancySourceEnum) => {
            const token = PROVIDER_TOKEN[provider];
            setRowBusy((prev) => ({ ...prev, [provider]: 'syncing' }));
            setRowError((prev) => ({ ...prev, [provider]: null }));
            setRowInfo((prev) => ({ ...prev, [provider]: null }));

            const result = await accommodationCalendarSyncApi.sync({
                id: accommodationId,
                provider: token
            });

            if (!result.ok) {
                setRowError((prev) => ({
                    ...prev,
                    [provider]: t(
                        'host.properties.editor.calendarSync.syncError',
                        'No pudimos sincronizar. Probá de nuevo en un rato.'
                    )
                }));
            } else if (result.data.status === 'ok') {
                setRowInfo((prev) => ({
                    ...prev,
                    [provider]: {
                        kind: 'success',
                        message: t(
                            'host.properties.editor.calendarSync.syncOk',
                            'Sincronización completa. Actualizamos tus fechas ocupadas.'
                        )
                    }
                }));
            } else if (result.data.status === 'error') {
                const isTerminalGoogle =
                    provider === OccupancySourceEnum.GOOGLE_CALENDAR &&
                    result.data.kind === 'terminal';
                setRowError((prev) => ({
                    ...prev,
                    [provider]: isTerminalGoogle
                        ? t(
                              'host.properties.editor.calendarSync.syncReconnect',
                              'Se perdió el acceso a tu Google Calendar. Reconectá para seguir sincronizando.'
                          )
                        : t(
                              'host.properties.editor.calendarSync.syncError',
                              'No pudimos sincronizar. Probá de nuevo en un rato.'
                          )
                }));
            } else {
                setRowInfo((prev) => ({
                    ...prev,
                    [provider]: {
                        kind: 'info',
                        message: t(
                            'host.properties.editor.calendarSync.syncSkipped',
                            'No hay una conexión activa para sincronizar.'
                        )
                    }
                }));
            }
            await refreshStatus();
            setRowBusy((prev) => ({ ...prev, [provider]: null }));
        },
        [accommodationId, refreshStatus, t]
    );

    // --- Disconnect ---
    const handleDisconnect = useCallback(
        async (provider: OccupancySourceEnum) => {
            const token = PROVIDER_TOKEN[provider];
            setRowBusy((prev) => ({ ...prev, [provider]: 'disconnecting' }));
            setRowError((prev) => ({ ...prev, [provider]: null }));
            setRowInfo((prev) => ({ ...prev, [provider]: null }));

            const result = await accommodationCalendarSyncApi.disconnect({
                id: accommodationId,
                provider: token
            });

            if (result.ok) {
                setRowInfo((prev) => ({
                    ...prev,
                    [provider]: {
                        kind: 'info',
                        message: t(
                            'host.properties.editor.calendarSync.disconnected',
                            'Desconectamos el calendario. Tus fechas ya sincronizadas quedan como están.'
                        )
                    }
                }));
            } else {
                setRowError((prev) => ({
                    ...prev,
                    [provider]: t(
                        'host.properties.editor.calendarSync.disconnectError',
                        'No pudimos desconectar. Probá de nuevo.'
                    )
                }));
            }
            await refreshStatus();
            setRowBusy((prev) => ({ ...prev, [provider]: null }));
        },
        [accommodationId, refreshStatus, t]
    );

    return (
        <section
            id="calendar-sync"
            ref={panelRef}
            className={styles.panel}
            aria-label={t(
                'host.properties.editor.calendarSync.title',
                'Sincronización de calendarios externos'
            )}
        >
            <div className={styles.header}>
                <h4 className={styles.title}>
                    {t(
                        'host.properties.editor.calendarSync.title',
                        'Sincronización de calendarios externos'
                    )}
                </h4>
            </div>

            <p className={styles.description}>
                {t(
                    'host.properties.editor.calendarSync.description',
                    'Conectá tus calendarios externos (Google, Airbnb, Booking.com u otro) y las fechas ocupadas se bloquearán automáticamente en tu calendario.'
                )}
            </p>

            {oauthBanner && (
                <div
                    className={
                        oauthBanner.kind === 'error'
                            ? styles.bannerError
                            : oauthBanner.kind === 'success'
                              ? styles.bannerSuccess
                              : styles.bannerInfo
                    }
                    role={oauthBanner.kind === 'error' ? 'alert' : 'status'}
                >
                    {oauthBanner.message}
                </div>
            )}

            {isLoading ? (
                <p className={styles.loading}>
                    {t('host.properties.editor.calendarSync.loading', 'Cargando conexiones...')}
                </p>
            ) : (
                <div className={styles.providerList}>
                    {PROVIDERS.map((provider) => (
                        <CalendarProviderRow
                            key={provider}
                            locale={locale}
                            t={t}
                            provider={provider}
                            connection={connections[provider]}
                            busy={rowBusy[provider] ?? null}
                            inlineError={rowError[provider] ?? null}
                            inlineInfo={rowInfo[provider] ?? null}
                            onConnectGoogle={handleConnectGoogle}
                            onConnectIcal={(feedUrl) => handleConnectIcal(provider, feedUrl)}
                            onSync={() => handleSync(provider)}
                            onDisconnect={() => handleDisconnect(provider)}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
