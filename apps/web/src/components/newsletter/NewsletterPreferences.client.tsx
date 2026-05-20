/**
 * @file NewsletterPreferences.client.tsx
 * @description React island that drives the newsletter preferences row on
 * the account page (SPEC-101 T-101-34).
 *
 * The island fetches `/api/v1/protected/newsletter/status` on mount and
 * renders ONE of the following layouts based on the lifecycle status:
 *
 *   active                → Status badge + subscribed-since + "Cancel"
 *                           button. Clicking "Cancel" reveals an inline
 *                           confirm dialog (Confirm + Stay) before the
 *                           DELETE /unsubscribe call fires.
 *   pending_verification  → Yellow badge + pending banner + "Resend"
 *                           button (POST /resend-verification).
 *   unsubscribed | null   → Grey badge + "Subscribe" button (POST
 *                           /subscribe with source='account_preferences').
 *   bounced               → Red badge with "Email inválido" message.
 *                           No actions exposed (terminal state).
 *   complained            → Red badge with "Cancelado" message.
 *                           No actions exposed (terminal state).
 *
 * Status badges use both colour AND a text label so the preference is
 * readable for users who can't perceive colour differences (AC-101-13.4).
 *
 * All copy comes from `account.newsletter.*` keys via `@repo/i18n`.
 */

import { type ApiErrorShape, translateApiError } from '@/lib/api-errors';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
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
    const [confirmCancel, setConfirmCancel] = useState<boolean>(false);
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
        async (path: string, method: 'POST' | 'DELETE'): Promise<boolean> => {
            setActionInFlight(true);
            const genericFallback = t(
                'newsletter.errorMessage',
                'No se pudo actualizar la suscripción'
            );
            try {
                const res = await fetch(joinApi(apiUrl, path), {
                    method,
                    credentials: 'include',
                    headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
                    body:
                        method === 'POST' && path.endsWith('/subscribe')
                            ? JSON.stringify({ locale, source: 'account_preferences' })
                            : undefined
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

    const handleSubscribe = useCallback(
        async (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const ok = await callAction('/api/v1/protected/newsletter/subscribe', 'POST');
            if (ok) {
                announce(
                    t(
                        'account.newsletter.pendingBanner',
                        'Revisá tu email para confirmar tu suscripción.'
                    )
                );
                await fetchStatus();
            }
        },
        [callAction, fetchStatus, t, announce]
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

    const handleUnsubscribe = useCallback(
        async (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const ok = await callAction('/api/v1/protected/newsletter/unsubscribe', 'DELETE');
            if (ok) {
                setConfirmCancel(false);
                await fetchStatus();
            }
        },
        [callAction, fetchStatus]
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
                <p className={styles.loading}>{t('newsletter.error', 'Cargando…')}</p>
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

    return (
        <section className={styles.wrapper}>
            <header className={styles.header}>
                <span className={styles.statusLabel}>
                    {t('account.newsletter.statusLabel', 'Estado')}
                </span>
                <StatusBadge
                    status={status}
                    t={t}
                />
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

            {/* === Active state — cancel with confirmation === */}
            {status === 'active' && !confirmCancel && (
                <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={() => setConfirmCancel(true)}
                    disabled={actionInFlight}
                >
                    {t('account.newsletter.cancelButton', 'Cancelar suscripción')}
                </button>
            )}

            {status === 'active' && confirmCancel && (
                <form
                    className={styles.confirmBox}
                    onSubmit={handleUnsubscribe}
                >
                    <p className={styles.confirmTitle}>
                        {t('account.newsletter.confirmCancelTitle', '¿Cancelar suscripción?')}
                    </p>
                    <div className={styles.confirmActions}>
                        <button
                            type="submit"
                            className={styles.dangerButton}
                            disabled={actionInFlight}
                        >
                            {t('account.newsletter.confirmCancelYes', 'Sí, cancelar')}
                        </button>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => setConfirmCancel(false)}
                            disabled={actionInFlight}
                        >
                            {t('account.newsletter.confirmCancelNo', 'No, quedarme')}
                        </button>
                    </div>
                </form>
            )}

            {/* === Pending verification — resend === */}
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

            {/* === Unsubscribed | null — subscribe === */}
            {(status === null || status === 'unsubscribed') && (
                <form onSubmit={handleSubscribe}>
                    <button
                        type="submit"
                        className={styles.primaryButton}
                        disabled={actionInFlight}
                    >
                        {t('account.newsletter.subscribeButton', 'Suscribirme')}
                    </button>
                </form>
            )}

            {/* === Bounced / complained — terminal, no actions === */}
            {(status === 'bounced' || status === 'complained') && (
                <p className={styles.terminalNote}>
                    {status === 'bounced'
                        ? t('account.newsletter.statusBounced', 'Email inválido')
                        : t('account.newsletter.statusComplained', 'Cancelado')}
                </p>
            )}
        </section>
    );
}

// ---------------------------------------------------------------------------
// Sub-component: status badge with label + colour AND text (a11y)
// ---------------------------------------------------------------------------

interface BadgeProps {
    readonly status: Status;
    // biome-ignore lint/suspicious/noExplicitAny: t-function signature varies by overload
    readonly t: (...args: any[]) => string;
}

function StatusBadge({ status, t }: BadgeProps) {
    if (status === null) {
        return (
            <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                {t('account.newsletter.statusUnsubscribed', 'No suscripto')}
            </span>
        );
    }
    const map: Record<
        Exclude<Status, null>,
        { className: string; key: string; fallback: string }
    > = {
        active: {
            className: styles.badgeActive,
            key: 'account.newsletter.statusActive',
            fallback: 'Activo'
        },
        pending_verification: {
            className: styles.badgePending,
            key: 'account.newsletter.statusPending',
            fallback: 'Pendiente de verificación'
        },
        unsubscribed: {
            className: styles.badgeNeutral,
            key: 'account.newsletter.statusUnsubscribed',
            fallback: 'No suscripto'
        },
        bounced: {
            className: styles.badgeError,
            key: 'account.newsletter.statusBounced',
            fallback: 'Email inválido'
        },
        complained: {
            className: styles.badgeError,
            key: 'account.newsletter.statusComplained',
            fallback: 'Cancelado'
        }
    };
    const cfg = map[status];
    return <span className={`${styles.badge} ${cfg.className}`}>{t(cfg.key, cfg.fallback)}</span>;
}
