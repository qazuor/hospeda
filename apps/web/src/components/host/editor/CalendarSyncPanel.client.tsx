/**
 * @file CalendarSyncPanel.client.tsx
 * @description Google Calendar connect/disconnect panel for the occupancy
 * calendar section (HOS-157 Phase 2 — Layer 5).
 *
 * Rendered at the top of `CalendarSection`, gated by the
 * `can_sync_external_calendar` entitlement. Lets a host:
 * - connect their Google Calendar (full-page OAuth round-trip),
 * - see the connection's last-sync health,
 * - trigger an on-demand sync,
 * - disconnect.
 *
 * The connect flow navigates the browser to Google's consent screen and, after
 * the API callback, returns here with a `?calendarSync=connected|error` flag
 * this panel reads on mount to show a result banner (then cleans the URL).
 *
 * @module components/host/editor/CalendarSyncPanel
 */

import {
    AlertCircleIcon,
    CheckCircleIcon,
    ClockIcon,
    GoogleIcon,
    SynchronizeIcon
} from '@repo/icons';
import { useCallback, useEffect, useState } from 'react';
import { accommodationCalendarSyncApi } from '@/lib/api/endpoints-protected';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import styles from './CalendarSyncPanel.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for CalendarSyncPanel. */
export interface CalendarSyncPanelProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
}

interface ConnectionState {
    readonly connected: boolean;
    readonly lastSyncAt: Date | null;
    readonly lastSyncStatus: 'PENDING' | 'OK' | 'ERROR';
    readonly lastErrorMessage: string | null;
}

type Banner = { readonly kind: 'success' | 'error' | 'info'; readonly message: string };
type Busy = 'connecting' | 'syncing' | 'disconnecting' | null;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Google Calendar connect/sync/disconnect panel.
 */
export function CalendarSyncPanel({ locale, accommodationId }: CalendarSyncPanelProps) {
    const { t } = createTranslations(locale);

    const [isLoading, setIsLoading] = useState(true);
    const [connection, setConnection] = useState<ConnectionState | null>(null);
    const [busy, setBusy] = useState<Busy>(null);
    const [banner, setBanner] = useState<Banner | null>(null);

    // --- Fetch connection status ---
    const refreshStatus = useCallback(async () => {
        const result = await accommodationCalendarSyncApi.status({ id: accommodationId });
        if (!result.ok) {
            webLogger.warn('[CalendarSyncPanel] status failed:', result.error);
            setConnection(null);
            return;
        }
        const { connected, status } = result.data;
        setConnection({
            connected,
            lastSyncAt: status?.lastSyncAt ? new Date(status.lastSyncAt) : null,
            lastSyncStatus: status?.lastSyncStatus ?? 'PENDING',
            lastErrorMessage: status?.lastErrorMessage ?? null
        });
    }, [accommodationId]);

    // --- On mount: read the OAuth callback result flag, then load status ---
    useEffect(() => {
        // Read + clear the ?calendarSync result flag left by the API callback.
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const flag = params.get('calendarSync');
            if (flag === 'connected') {
                setBanner({
                    kind: 'success',
                    message: t(
                        'host.properties.editor.calendarSync.connectedBanner',
                        'Tu Google Calendar quedó conectado. Ya vamos a sincronizar tus fechas ocupadas.'
                    )
                });
            } else if (flag === 'error') {
                setBanner({
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

    // --- Connect: full-page navigate to Google's consent screen ---
    const handleConnect = useCallback(async () => {
        setBusy('connecting');
        setBanner(null);
        // Return to this editor page (without any prior result flag) afterwards.
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
        setBanner({
            kind: 'error',
            message: t(
                'host.properties.editor.calendarSync.connectErrorBanner',
                'No pudimos conectar tu Google Calendar. Probá de nuevo.'
            )
        });
        setBusy(null);
    }, [accommodationId, t]);

    // --- Sync now ---
    const handleSync = useCallback(async () => {
        setBusy('syncing');
        setBanner(null);
        const result = await accommodationCalendarSyncApi.sync({ id: accommodationId });
        if (!result.ok) {
            setBanner({
                kind: 'error',
                message: t(
                    'host.properties.editor.calendarSync.syncError',
                    'No pudimos sincronizar. Probá de nuevo en un rato.'
                )
            });
        } else if (result.data.status === 'ok') {
            setBanner({
                kind: 'success',
                message: t(
                    'host.properties.editor.calendarSync.syncOk',
                    'Sincronización completa. Actualizamos tus fechas ocupadas.'
                )
            });
        } else if (result.data.status === 'error') {
            setBanner({
                kind: 'error',
                message:
                    result.data.kind === 'terminal'
                        ? t(
                              'host.properties.editor.calendarSync.syncReconnect',
                              'Se perdió el acceso a tu Google Calendar. Reconectá para seguir sincronizando.'
                          )
                        : t(
                              'host.properties.editor.calendarSync.syncError',
                              'No pudimos sincronizar. Probá de nuevo en un rato.'
                          )
            });
        } else {
            setBanner({
                kind: 'info',
                message: t(
                    'host.properties.editor.calendarSync.syncSkipped',
                    'No hay una conexión activa para sincronizar.'
                )
            });
        }
        await refreshStatus();
        setBusy(null);
    }, [accommodationId, refreshStatus, t]);

    // --- Disconnect ---
    const handleDisconnect = useCallback(async () => {
        setBusy('disconnecting');
        setBanner(null);
        const result = await accommodationCalendarSyncApi.disconnect({ id: accommodationId });
        if (result.ok) {
            setBanner({
                kind: 'info',
                message: t(
                    'host.properties.editor.calendarSync.disconnected',
                    'Desconectamos tu Google Calendar. Tus fechas ya sincronizadas quedan como están.'
                )
            });
        } else {
            setBanner({
                kind: 'error',
                message: t(
                    'host.properties.editor.calendarSync.disconnectError',
                    'No pudimos desconectar. Probá de nuevo.'
                )
            });
        }
        await refreshStatus();
        setBusy(null);
    }, [accommodationId, refreshStatus, t]);

    // --- Rendering ---

    const isConnected = connection?.connected ?? false;
    const lastSyncLabel = connection?.lastSyncAt
        ? formatDate({
              date: connection.lastSyncAt,
              locale,
              options: { dateStyle: 'medium', timeStyle: 'short' }
          })
        : null;

    return (
        <section
            className={styles.panel}
            aria-label={t(
                'host.properties.editor.calendarSync.title',
                'Sincronización con Google Calendar'
            )}
        >
            <div className={styles.header}>
                <GoogleIcon
                    size={18}
                    weight="regular"
                    aria-hidden="true"
                />
                <h4 className={styles.title}>
                    {t(
                        'host.properties.editor.calendarSync.title',
                        'Sincronización con Google Calendar'
                    )}
                </h4>
            </div>

            <p className={styles.description}>
                {t(
                    'host.properties.editor.calendarSync.description',
                    'Conectá un Google Calendar y las fechas con eventos se bloquearán automáticamente en tu calendario de ocupación.'
                )}
            </p>

            {banner && (
                <div
                    className={
                        banner.kind === 'error'
                            ? styles.bannerError
                            : banner.kind === 'success'
                              ? styles.bannerSuccess
                              : styles.bannerInfo
                    }
                    role={banner.kind === 'error' ? 'alert' : 'status'}
                >
                    {banner.message}
                </div>
            )}

            {isLoading ? (
                <p className={styles.loading}>
                    {t('host.properties.editor.calendarSync.loading', 'Cargando conexión...')}
                </p>
            ) : isConnected ? (
                <div className={styles.connected}>
                    <div className={styles.statusRow}>
                        {connection?.lastSyncStatus === 'ERROR' ? (
                            <AlertCircleIcon
                                size={16}
                                weight="fill"
                                className={styles.statusIconError}
                                aria-hidden="true"
                            />
                        ) : (
                            <CheckCircleIcon
                                size={16}
                                weight="fill"
                                className={styles.statusIconOk}
                                aria-hidden="true"
                            />
                        )}
                        <span className={styles.statusText}>
                            {connection?.lastSyncStatus === 'ERROR'
                                ? t(
                                      'host.properties.editor.calendarSync.statusError',
                                      'La última sincronización falló'
                                  )
                                : connection?.lastSyncStatus === 'OK'
                                  ? t(
                                        'host.properties.editor.calendarSync.statusOk',
                                        'Conectado y sincronizado'
                                    )
                                  : t(
                                        'host.properties.editor.calendarSync.statusPending',
                                        'Conectado, sincronización pendiente'
                                    )}
                        </span>
                    </div>

                    {lastSyncLabel && (
                        <p className={styles.lastSync}>
                            <ClockIcon
                                size={14}
                                weight="regular"
                                aria-hidden="true"
                            />
                            {t(
                                'host.properties.editor.calendarSync.lastSyncAt',
                                'Última sincronización:'
                            )}{' '}
                            {lastSyncLabel}
                        </p>
                    )}

                    <div className={styles.actions}>
                        <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={handleSync}
                            disabled={busy !== null}
                        >
                            <SynchronizeIcon
                                size={16}
                                weight="regular"
                                aria-hidden="true"
                            />
                            {busy === 'syncing'
                                ? t(
                                      'host.properties.editor.calendarSync.syncing',
                                      'Sincronizando...'
                                  )
                                : t(
                                      'host.properties.editor.calendarSync.syncNow',
                                      'Sincronizar ahora'
                                  )}
                        </button>
                        {connection?.lastSyncStatus === 'ERROR' && (
                            <button
                                type="button"
                                className={styles.primaryButton}
                                onClick={handleConnect}
                                disabled={busy !== null}
                            >
                                {t('host.properties.editor.calendarSync.reconnect', 'Reconectar')}
                            </button>
                        )}
                        <button
                            type="button"
                            className={styles.dangerButton}
                            onClick={handleDisconnect}
                            disabled={busy !== null}
                        >
                            {busy === 'disconnecting'
                                ? t(
                                      'host.properties.editor.calendarSync.disconnecting',
                                      'Desconectando...'
                                  )
                                : t(
                                      'host.properties.editor.calendarSync.disconnect',
                                      'Desconectar'
                                  )}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={handleConnect}
                    disabled={busy !== null}
                >
                    <GoogleIcon
                        size={16}
                        weight="regular"
                        aria-hidden="true"
                    />
                    {busy === 'connecting'
                        ? t('host.properties.editor.calendarSync.connecting', 'Conectando...')
                        : t(
                              'host.properties.editor.calendarSync.connect',
                              'Conectar Google Calendar'
                          )}
                </button>
            )}
        </section>
    );
}
