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
 * time, "Sync now", and "Disconnect" — **except** a connected iCal provider
 * whose `lastSyncStatus` is `'ERROR'` (a broken feed): that row additionally
 * surfaces the specific `lastErrorMessage` and re-renders the feed-URL form
 * so the host can re-paste a corrected URL in place, without having to
 * Disconnect first (judgment-day fix A3/#3 — Google already had an
 * equivalent "Reconectar" affordance for its own terminal-error state).
 */

import {
    AlertCircleIcon,
    CheckCircleIcon,
    ClockIcon,
    GoogleIcon,
    SynchronizeIcon
} from '@repo/icons';
import { ConnectIcalBodySchema, OccupancySourceEnum } from '@repo/schemas';
import { useState } from 'react';
import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import type { CalendarProviderConnectionStatus } from '@/lib/api/endpoints-protected';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format-utils';
import { useZodForm } from '@/lib/forms/use-zod-form';
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
// IcalFeedForm — shared by the initial connect flow and the in-place
// re-paste flow for a broken feed. Kept as a local (non-exported) helper so
// both call sites stay in sync instead of duplicating the markup.
// ---------------------------------------------------------------------------

/** Props for the shared iCal feed URL form. */
interface IcalFeedFormProps {
    readonly t: TranslationFn;
    readonly provider: OccupancySourceEnum;
    readonly feedUrl: string;
    readonly onFeedUrlChange: (value: string) => void;
    /**
     * Invoked when the host confirms the feed URL (button click or Enter).
     * This is intentionally NOT a form `onSubmit`: the whole provider row is
     * rendered inside the accommodation editor's `<form>`, and a nested
     * `<form>` is invalid HTML — the browser drops it and the inner submit
     * falls through to a native GET on the outer form, reloading the page
     * without ever connecting. See the `<div>` (not `<form>`) below.
     */
    readonly onSubmitFeed: () => void;
    readonly busy: ProviderRowBusy;
    readonly submitLabel: string;
    readonly submitBusyLabel: string;
    readonly helpText: string;
    /** Client-side validation error for `feedUrl` (from `ConnectIcalBodySchema`), if any. */
    readonly feedUrlError?: string;
}

/** The `.ics` feed URL input + submit button, reused for connect and reconnect. */
function IcalFeedForm({
    t,
    provider,
    feedUrl,
    onFeedUrlChange,
    onSubmitFeed,
    busy,
    submitLabel,
    submitBusyLabel,
    helpText,
    feedUrlError
}: IcalFeedFormProps) {
    const inputId = `ical-feed-url-${provider}`;
    const errorId = fieldErrorId(inputId);

    // A plain <div>, not a <form>: this markup is nested inside the editor's
    // own <form>, and nested forms are invalid HTML. Enter-to-submit is
    // preserved manually via the input's onKeyDown below.
    return (
        <div className={styles.icalForm}>
            <label htmlFor={inputId}>
                <span className={styles.fieldLabel}>
                    {t('host.properties.editor.calendarSync.feedUrlLabel', 'URL del feed .ics')}
                </span>
            </label>
            <input
                id={inputId}
                type="url"
                inputMode="url"
                className={styles.fieldInput}
                value={feedUrl}
                onChange={(event) => onFeedUrlChange(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        onSubmitFeed();
                    }
                }}
                placeholder={t(
                    'host.properties.editor.calendarSync.feedUrlPlaceholder',
                    'https://ejemplo.com/calendario.ics'
                )}
                disabled={busy !== null}
                aria-invalid={!!feedUrlError}
                aria-describedby={feedUrlError ? errorId : undefined}
                required
            />
            <FieldError
                id={errorId}
                message={feedUrlError}
            />
            <p className={styles.fieldHelp}>{helpText}</p>
            <button
                type="button"
                className={styles.primaryButton}
                onClick={onSubmitFeed}
                disabled={busy !== null}
            >
                {busy === 'connecting' ? submitBusyLabel : submitLabel}
            </button>
        </div>
    );
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
    // A connected iCal (non-Google) provider whose last sync errored — the
    // host has no in-place way to fix it besides re-pasting the feed URL
    // (Disconnect + reconnect would also work, but this is the direct path).
    const isIcalBroken = !isGoogle && isConnected && connection?.lastSyncStatus === 'ERROR';
    const [feedUrl, setFeedUrl] = useState('');
    const { fieldErrors, validate, clearError } = useZodForm({ schema: ConnectIcalBodySchema, t });

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

    const handleFeedUrlChange = (value: string) => {
        setFeedUrl(value);
        if (fieldErrors.feedUrl) {
            clearError('feedUrl');
        }
    };

    const handleConnectIcal = () => {
        const trimmed = feedUrl.trim();
        const result = validate({ provider: sourceKeySuffix(provider), feedUrl: trimmed });
        if (!result.success) return;
        onConnectIcal(trimmed);
    };

    // The specific reason a broken iCal feed failed, when the API provided
    // one — falls back to the generic connect-error copy otherwise.
    const icalBrokenMessage = connection?.lastErrorMessage
        ? `${t(
              'host.properties.editor.calendarSync.icalErrorPrefix',
              'No pudimos leer el calendario:'
          )} ${connection.lastErrorMessage}`
        : t(
              'host.properties.editor.calendarSync.connectIcalError',
              'No pudimos conectar ese calendario. Revisá la URL e intentá de nuevo.'
          );

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

                    {isIcalBroken && (
                        <p
                            className={styles.rowError}
                            role="alert"
                        >
                            {icalBrokenMessage}
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

                    {isIcalBroken && (
                        <IcalFeedForm
                            t={t}
                            provider={provider}
                            feedUrl={feedUrl}
                            onFeedUrlChange={handleFeedUrlChange}
                            onSubmitFeed={handleConnectIcal}
                            busy={busy}
                            submitLabel={t(
                                'host.properties.editor.calendarSync.reconnectIcal',
                                'Reconectar'
                            )}
                            submitBusyLabel={t(
                                'host.properties.editor.calendarSync.connecting',
                                'Conectando...'
                            )}
                            helpText={t(
                                'host.properties.editor.calendarSync.reconnectIcalHelp',
                                'Volvé a pegar la URL corregida del calendario para reconectarlo.'
                            )}
                            feedUrlError={fieldErrors.feedUrl}
                        />
                    )}
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
                <IcalFeedForm
                    t={t}
                    provider={provider}
                    feedUrl={feedUrl}
                    onFeedUrlChange={handleFeedUrlChange}
                    onSubmitFeed={handleConnectIcal}
                    busy={busy}
                    submitLabel={t('host.properties.editor.calendarSync.connectIcal', 'Conectar')}
                    submitBusyLabel={t(
                        'host.properties.editor.calendarSync.connecting',
                        'Conectando...'
                    )}
                    helpText={t(
                        'host.properties.editor.calendarSync.feedUrlHelp',
                        'Pegá la URL de exportación del calendario en formato iCal (.ics) de esa plataforma.'
                    )}
                    feedUrlError={fieldErrors.feedUrl}
                />
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
