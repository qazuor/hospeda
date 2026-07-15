/**
 * @file CalendarProviderRow.client.tsx
 * @description One provider's connect/sync/disconnect row inside
 * `CalendarSyncPanel.client.tsx` (HOS-162 Phase 3 — Layer F).
 *
 * Split out of the panel to keep it under the 500-line project limit and to
 * make each provider's connect/connected UI independently testable. Handles
 * two distinct connect flows:
 * - **Google** — full-page OAuth round-trip (`onConnectGoogle`), no local form.
 * - **Airbnb / Booking.com / Other** — inline `.ics` feed URL form
 *   (`onConnectIcal`), no redirect; the parent surfaces a 400 validation
 *   error next to this row via `inlineError`.
 *
 * Once connected (any provider), the row looks identical: status, last sync
 * time, "Sync now", and "Disconnect".
 */

import {
    AlertCircleIcon,
    CheckCircleIcon,
    ClockIcon,
    GoogleIcon,
    SynchronizeIcon
} from '@repo/icons';
import { OccupancySourceEnum } from '@repo/schemas';
import { useState } from 'react';
import type { CalendarProviderConnectionStatus } from '@/lib/api/endpoints-protected';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import { sourceFallbackLabel, sourceKeySuffix } from './CalendarDayCell.client';
import styles from './CalendarSyncPanel.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Which action is in flight for this row, if any. */
export type ProviderRowBusy = 'connecting' | 'syncing' | 'disconnecting' | null;

/** Props for CalendarProviderRow. */
export interface CalendarProviderRowProps {
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
    /** Which provider this row represents. */
    readonly provider: OccupancySourceEnum;
    /** The provider's current connection state, or `undefined` if never connected. */
    readonly connection: CalendarProviderConnectionStatus | undefined;
    readonly busy: ProviderRowBusy;
    /** Inline error from a failed `connect-ical`/sync/disconnect call, if any. */
    readonly inlineError: string | null;
    /** Inline result message from a successful sync/disconnect action, if any. */
    readonly inlineInfo: { readonly kind: 'success' | 'info'; readonly message: string } | null;
    /** Google only — starts the OAuth round-trip. */
    readonly onConnectGoogle: () => void;
    /** iCal providers only — connects the given feed URL. */
    readonly onConnectIcal: (feedUrl: string) => void;
    readonly onSync: () => void;
    readonly onDisconnect: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** CSS module class for a provider's header dot indicator (Google uses a real icon instead). */
function providerDotClass(provider: OccupancySourceEnum): string {
    switch (provider) {
        case OccupancySourceEnum.AIRBNB:
            return styles.dotAirbnb;
        case OccupancySourceEnum.BOOKING:
            return styles.dotBooking;
        default:
            return styles.dotOther;
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** One provider's connect/sync/disconnect row. */
export function CalendarProviderRow({
    locale,
    t,
    provider,
    connection,
    busy,
    inlineError,
    inlineInfo,
    onConnectGoogle,
    onConnectIcal,
    onSync,
    onDisconnect
}: CalendarProviderRowProps) {
    const isGoogle = provider === OccupancySourceEnum.GOOGLE_CALENDAR;
    const isConnected = connection?.connected ?? false;
    const [feedUrl, setFeedUrl] = useState('');

    const providerLabel = t(
        `host.properties.editor.calendar.source.${sourceKeySuffix(provider)}`,
        sourceFallbackLabel(provider)
    );

    const lastSyncLabel = connection?.lastSyncAt
        ? formatDate({
              date: new Date(connection.lastSyncAt),
              locale,
              options: { dateStyle: 'medium', timeStyle: 'short' }
          })
        : null;

    const handleConnectIcalSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (feedUrl.trim()) {
            onConnectIcal(feedUrl.trim());
        }
    };

    return (
        <div
            className={styles.providerCard}
            data-testid={`calendar-provider-row-${provider}`}
        >
            <div className={styles.providerHeader}>
                {isGoogle ? (
                    <GoogleIcon
                        size={16}
                        weight="regular"
                        aria-hidden="true"
                    />
                ) : (
                    <span
                        className={cn(styles.providerDot, providerDotClass(provider))}
                        aria-hidden="true"
                    />
                )}
                <span className={styles.providerTitle}>{providerLabel}</span>
                {isConnected && (
                    <span className={styles.connectedPill}>
                        {connection?.lastSyncStatus === 'ERROR' ? (
                            <AlertCircleIcon
                                size={12}
                                weight="fill"
                                aria-hidden="true"
                            />
                        ) : (
                            <CheckCircleIcon
                                size={12}
                                weight="fill"
                                aria-hidden="true"
                            />
                        )}
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
                )}
            </div>

            {isConnected ? (
                <div className={styles.connected}>
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
                            onClick={onSync}
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
                        {isGoogle && connection?.lastSyncStatus === 'ERROR' && (
                            <button
                                type="button"
                                className={styles.primaryButton}
                                onClick={onConnectGoogle}
                                disabled={busy !== null}
                            >
                                {t('host.properties.editor.calendarSync.reconnect', 'Reconectar')}
                            </button>
                        )}
                        <button
                            type="button"
                            className={styles.dangerButton}
                            onClick={onDisconnect}
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
            ) : isGoogle ? (
                <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={onConnectGoogle}
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
            ) : (
                <form
                    className={styles.icalForm}
                    onSubmit={handleConnectIcalSubmit}
                >
                    <label htmlFor={`ical-feed-url-${provider}`}>
                        <span className={styles.fieldLabel}>
                            {t(
                                'host.properties.editor.calendarSync.feedUrlLabel',
                                'URL del feed .ics'
                            )}
                        </span>
                    </label>
                    <input
                        id={`ical-feed-url-${provider}`}
                        type="url"
                        inputMode="url"
                        className={styles.fieldInput}
                        value={feedUrl}
                        onChange={(event) => setFeedUrl(event.target.value)}
                        placeholder={t(
                            'host.properties.editor.calendarSync.feedUrlPlaceholder',
                            'https://ejemplo.com/calendario.ics'
                        )}
                        disabled={busy !== null}
                        required
                    />
                    <p className={styles.fieldHelp}>
                        {t(
                            'host.properties.editor.calendarSync.feedUrlHelp',
                            'Pegá la URL de exportación del calendario en formato iCal (.ics) de esa plataforma.'
                        )}
                    </p>
                    <button
                        type="submit"
                        className={styles.primaryButton}
                        disabled={busy !== null}
                    >
                        {busy === 'connecting'
                            ? t('host.properties.editor.calendarSync.connecting', 'Conectando...')
                            : t('host.properties.editor.calendarSync.connectIcal', 'Conectar')}
                    </button>
                </form>
            )}

            {inlineError && (
                <div
                    className={styles.rowError}
                    role="alert"
                >
                    {inlineError}
                </div>
            )}
            {inlineInfo && (
                <div
                    className={inlineInfo.kind === 'success' ? styles.rowSuccess : styles.rowInfo}
                    role="status"
                >
                    {inlineInfo.message}
                </div>
            )}
        </div>
    );
}
