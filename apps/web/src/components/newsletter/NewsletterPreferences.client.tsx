/**
 * @file NewsletterPreferences.client.tsx
 * @description React island that drives the newsletter preferences row on
 * the account page (SPEC-101 T-101-34).
 *
 * HOS-2479: the on/off (subscribe, cancel) and the per-content-type switches
 * moved to Preferences (D11). This island now SHOWS the lifecycle status as a
 * StatusPill and links to Preferences to change it. It keeps the read-only
 * extras (subscribed-since, channels) and the resend-verification action,
 * which is not an on/off. The rest of the page is HOS-2501.
 *
 * Status pills carry both colour AND a text label (AC-101-13.4).
 *
 * All copy comes from `account.newsletter.*` keys via `@repo/i18n`.
 */

import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Spinner } from '@/components/shared/feedback/Spinner';
import { type ApiErrorShape, translateApiError } from '@/lib/api-errors';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { StatusPill, type StatusTone, TextLink } from '../account/ui';
import styles from './NewsletterPreferences.module.css';

/** Subset of NewsletterSubscriberStatusEnum values returned by GET /status. */
type Status = 'active' | 'pending_verification' | 'unsubscribed' | 'bounced' | 'complained' | null;

interface StatusResponse {
    readonly subscribed: boolean;
    readonly status: Status;
    readonly subscribedAt: string | null;
    readonly verifiedAt: string | null;
}

/** Public props consumed from `mi-cuenta/newsletter.astro`. */
export interface NewsletterPreferencesProps {
    /** Active UI locale, used for i18n + date formatting. */
    readonly locale: SupportedLocale;
    /** Public API base URL the island posts against. */
    readonly apiUrl: string;
}

type IslandState =
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; data: StatusResponse };

/** Trim trailing slash so URL concat never yields `/api/v1//newsletter/...`. */
function joinApi(apiUrl: string, path: string): string {
    return `${apiUrl.replace(/\/$/, '')}${path}`;
}

/**
 * Try to read the API error envelope from a failing fetch response.
 * Returns the `error` object when present, or `null` if the body is empty,
 * non-JSON, or doesn't match the standard `{ success, error }` shape.
 */
async function readApiError(res: Response): Promise<ApiErrorShape | null> {
    try {
        const body = (await res.json()) as { readonly error?: ApiErrorShape };
        return body?.error ?? null;
    } catch {
        return null;
    }
}

/**
 * Format an ISO timestamp into the user's locale long-form date.
 * Returns the empty string for missing input.
 */
function formatLongDate(input: string | null, locale: SupportedLocale): string {
    if (!input) return '';
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);
}

/** React island for the newsletter row on the account preferences page. */
export function NewsletterPreferences({ locale, apiUrl }: NewsletterPreferencesProps) {
    const { t } = createTranslations(locale);

    const liveRegionId = useId();

    const [island, setIsland] = useState<IslandState>({ kind: 'loading' });
    const [actionInFlight, setActionInFlight] = useState<boolean>(false);
    const [statusText, setStatusText] = useState<string>('');
    const isMountedRef = useRef<boolean>(true);

    // ------------------------------------------------------------------
    // Status fetch on mount
    // ------------------------------------------------------------------

    const fetchStatus = useCallback(
        async (signal?: AbortSignal): Promise<void> => {
            const genericFallback = t('newsletter.error', 'Ocurrió un error. Intentá de nuevo.');
            try {
                const res = await fetch(joinApi(apiUrl, '/api/v1/protected/newsletter/status'), {
                    credentials: 'include',
                    signal
                });
                if (!res.ok) {
                    if (!isMountedRef.current) return;
                    const apiError = await readApiError(res);
                    setIsland({
                        kind: 'error',
                        message: translateApiError({
                            error: apiError,
                            locale,
                            fallback: genericFallback
                        })
                    });
                    return;
                }
                // API responses are wrapped in { success, data, metadata }.
                // Unwrap `data` before storing — earlier the whole envelope
                // was being treated as the status payload, leaving every
                // field undefined and crashing StatusBadge with
                // "Cannot read properties of undefined (reading 'className')".
                const envelope = (await res.json()) as {
                    readonly success?: boolean;
                    readonly data?: StatusResponse;
                };
                if (!isMountedRef.current) return;
                const data = envelope.data;
                if (!data) {
                    setIsland({ kind: 'error', message: genericFallback });
                    return;
                }
                setIsland({ kind: 'ready', data });
            } catch (err) {
                if ((err as Error).name === 'AbortError') return;
                if (!isMountedRef.current) return;
                setIsland({ kind: 'error', message: genericFallback });
            }
        },
        [apiUrl, locale, t]
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: single-shot mount effect; deps don't change after hydration
    useEffect(() => {
        isMountedRef.current = true;
        const controller = new AbortController();
        void fetchStatus(controller.signal);
        return () => {
            isMountedRef.current = false;
            controller.abort();
        };
    }, []);

    // ------------------------------------------------------------------
    // Actions: subscribe / resend / unsubscribe
    // ------------------------------------------------------------------

    const announce = useCallback((text: string) => {
        setStatusText(text);
    }, []);

    const callAction = useCallback(
        async (path: string, method: 'POST'): Promise<boolean> => {
            setActionInFlight(true);
            const genericFallback = t(
                'newsletter.errorMessage',
                'No se pudo actualizar la suscripción'
            );
            try {
                const res = await fetch(joinApi(apiUrl, path), {
                    method,
                    credentials: 'include'
                });
                if (!res.ok) {
                    const apiError = await readApiError(res);
                    announce(
                        translateApiError({
                            error: apiError,
                            locale,
                            fallback: genericFallback
                        })
                    );
                    return false;
                }
                return true;
            } catch {
                announce(genericFallback);
                return false;
            } finally {
                if (isMountedRef.current) {
                    setActionInFlight(false);
                }
            }
        },
        [apiUrl, locale, t, announce]
    );

    const handleResend = useCallback(
        async (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const ok = await callAction('/api/v1/protected/newsletter/resend-verification', 'POST');
            if (ok) {
                announce(
                    t(
                        'newsletter.errorPage.resendSuccess',
                        'Reenviamos el email de confirmación. Revisá tu bandeja de entrada.'
                    )
                );
            }
        },
        [callAction, t, announce]
    );

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------

    if (island.kind === 'loading') {
        return (
            <section
                className={styles.wrapper}
                aria-busy="true"
            >
                <p className={styles.loading}>
                    {/* Decorative — the visible text + the section's aria-busy already announce. */}
                    <Spinner size="sm" />
                    {t('account.newsletter.loading', 'Cargando…')}
                </p>
            </section>
        );
    }

    if (island.kind === 'error') {
        return (
            <section className={styles.wrapper}>
                <p
                    className={styles.error}
                    role="alert"
                >
                    {island.message}
                </p>
            </section>
        );
    }

    const data = island.data;
    const status = data.status;
    const preferencesHref = buildUrl({ locale, path: 'mi-cuenta/preferencias' });

    return (
        <section className={styles.wrapper}>
            <header className={styles.header}>
                <span className={styles.statusLabel}>
                    {t('account.newsletter.statusLabel', 'Estado')}
                </span>
                <StatusPill tone={STATUS_PRESENTATION[status ?? 'unsubscribed'].tone}>
                    {t(STATUS_PRESENTATION[status ?? 'unsubscribed'].key)}
                </StatusPill>
            </header>

            {data.subscribedAt && status !== null && (
                <p className={styles.metadata}>
                    {t('account.newsletter.subscribedSince', 'Suscripto desde')}:{' '}
                    <strong>{formatLongDate(data.subscribedAt, locale)}</strong>
                </p>
            )}

            {/* aria-live region announces every action transition */}
            <div
                id={liveRegionId}
                className={styles.srOnly}
                aria-live="polite"
                aria-atomic="true"
            >
                {statusText}
            </div>

            {/* HOS-2479: the on/off lives in Preferences (one source per setting). */}
            <p>
                <TextLink href={preferencesHref}>
                    {t('account.preferences.changeInPreferences')}
                </TextLink>
            </p>

            {status === 'active' && <ChannelList t={t} />}

            {/* === Pending verification — resend (not an on/off) === */}
            {status === 'pending_verification' && (
                <>
                    <p className={styles.pendingBanner}>
                        {t(
                            'account.newsletter.pendingBanner',
                            'Revisá tu email para confirmar tu suscripción.'
                        )}
                    </p>
                    <form onSubmit={handleResend}>
                        <button
                            type="submit"
                            className={styles.primaryButton}
                            disabled={actionInFlight}
                        >
                            {t(
                                'account.newsletter.resendVerification',
                                'Reenviar email de confirmación'
                            )}
                        </button>
                    </form>
                </>
            )}
        </section>
    );
}

/** Lifecycle status to its pill tone and i18n key. */
const STATUS_PRESENTATION: Record<
    Exclude<Status, null>,
    { readonly tone: StatusTone; readonly key: string }
> = {
    active: { tone: 'success', key: 'account.newsletter.statusActive' },
    pending_verification: { tone: 'warning', key: 'account.newsletter.statusPending' },
    unsubscribed: { tone: 'neutral', key: 'account.newsletter.statusUnsubscribed' },
    bounced: { tone: 'danger', key: 'account.newsletter.statusBounced' },
    complained: { tone: 'danger', key: 'account.newsletter.statusComplained' }
};

// ---------------------------------------------------------------------------
// Sub-component: per-channel section (Email always enabled, WhatsApp soon)
// ---------------------------------------------------------------------------

interface ChannelListProps {
    // biome-ignore lint/suspicious/noExplicitAny: t-function signature varies by overload
    readonly t: (...args: any[]) => string;
}

/**
 * Static channel summary for active subscribers. Email is the only MVP
 * delivery channel; WhatsApp ships disabled with a "próximamente" badge so
 * the user sees it's on the roadmap but can't toggle it yet.
 */
function ChannelList({ t }: ChannelListProps) {
    return (
        <section
            className={styles.channelSection}
            aria-labelledby="newsletter-channels-heading"
        >
            <h3
                id="newsletter-channels-heading"
                className={styles.channelHeading}
            >
                {t('account.newsletter.channels.title', 'Cómo te llegan')}
            </h3>
            <ul className={styles.channelList}>
                <li className={styles.channelItem}>
                    <span className={styles.channelLabel}>
                        {t('account.newsletter.channels.email', 'Email')}
                    </span>
                    <span className={`${styles.channelBadge} ${styles.channelBadgeOn}`}>
                        {t('account.newsletter.channels.enabled', 'Activado')}
                    </span>
                </li>
                <li className={`${styles.channelItem} ${styles.channelItemDisabled}`}>
                    <span className={styles.channelLabel}>
                        {t('account.newsletter.channels.whatsapp', 'WhatsApp')}
                    </span>
                    <span className={`${styles.channelBadge} ${styles.channelBadgeSoon}`}>
                        {t('account.newsletter.channels.comingSoon', 'Próximamente')}
                    </span>
                </li>
            </ul>
        </section>
    );
}
