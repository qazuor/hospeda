/**
 * @file NewsletterForm.client.tsx
 * @description React island replacing the static footer newsletter form.
 *
 * Visual states:
 * - idle-guest:           Guest visitor — editable email input, submit → POST /public/subscribe → redirect.
 * - idle-auth:            Authenticated, not yet subscribed — email pre-filled from session, read-only.
 * - pending:              Subscription request in-flight — spinner, button disabled, aria-busy.
 * - pending-verification: Submit succeeded with pending status — fallback banner (when redirect doesn't happen).
 * - already-active:       Already subscribed — banner with manage link.
 * - error:                API failure — inline error, button re-enabled.
 *
 * Guest path (feat/newsletter-polish): the visitor types their email into the
 * input and clicks submit; the form POSTs to /api/v1/public/newsletter/subscribe
 * and redirects to `/{locale}/newsletter/confirma-tu-email?email=<their-email>`
 * regardless of pending_verification / already_pending — both responses mean
 * the same thing for UX ("we sent an email, go check"). No AuthRequiredPopover,
 * no login gate.
 *
 * Authentication decision: the Astro Footer passes the server-rendered hint via the
 * `isAuthenticated` + `userEmail` props (read from `Astro.locals`). Those props are
 * accurate ONLY on routes where the middleware parses the session (protected, auth,
 * SESSION_OPTIONAL_SEGMENTS). On home, contacto, legal pages, etc. `Astro.locals.user`
 * is null even when the visitor has a live cookie, so the island MUST re-resolve its
 * auth state client-side on mount via the cached `/api/v1/public/auth/me` snapshot
 * (the same cache UserMenu populates). Without this the footer always renders the
 * guest variant outside session-aware routes.
 *
 * Hydration: designed for `client:visible` (lazy hydration on scroll into view).
 * SSR renders the input + button without JavaScript; hydration adds interactive behavior.
 *
 * Analytics: fires `newsletter_subscribe_clicked` and `newsletter_subscribe_success`
 * to `window.dataLayer` when available.
 */

import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/posthog-client';
import { AUTH_ME_CACHE_KEY } from '@/lib/auth-cache';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useEffect, useId, useState } from 'react';
import styles from './NewsletterForm.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Visual state machine for the newsletter subscription form.
 * Drives which UI section is rendered.
 */
type FormState =
    | 'idle-guest'
    | 'idle-auth'
    | 'pending'
    | 'pending-verification'
    | 'already-active'
    | 'unsubscribing'
    | 'blocked-unverified'
    | 'error';

/**
 * Shape of an API error response envelope. The `reason` field carries the
 * machine-readable identifier the route layer attaches to ServiceError; the
 * island branches on it (e.g. NEWSLETTER_ACCOUNT_EMAIL_UNVERIFIED) to render
 * a specific UI rather than the generic error banner.
 */
type ApiErrorResponse = {
    readonly success?: false;
    readonly error?: {
        readonly code?: string;
        readonly message?: string;
        readonly reason?: string;
    };
};

/**
 * Shape of the POST /api/v1/protected/newsletter/subscribe response.
 */
type SubscribeResponse = {
    readonly status: 'pending_verification' | 'active' | 'already_pending';
};

/**
 * Shape of the GET /api/v1/protected/newsletter/status response.
 */
type StatusResponse = {
    readonly subscribed: boolean;
    readonly status:
        | 'pending_verification'
        | 'active'
        | 'unsubscribed'
        | 'bounced'
        | 'complained'
        | null;
    readonly subscribedAt: string | null;
    readonly verifiedAt: string | null;
};

/**
 * Props for the {@link NewsletterForm} island.
 */
export interface NewsletterFormProps {
    /**
     * Whether the current user is authenticated.
     * Resolved from `Astro.locals` in the Footer Astro component.
     * Used as the initial SSR seed; the client re-resolves on mount via
     * the shared `/auth/me` cache.
     */
    readonly isAuthenticated: boolean;
    /**
     * The authenticated user's email address, pre-filled into the input.
     * Only meaningful when `isAuthenticated` is true.
     */
    readonly userEmail?: string;
    /**
     * Base URL of the API (e.g. "https://api.hospeda.com.ar").
     * Used to build the endpoint URLs for subscribe, resend, status, and
     * the guest /public/auth/me lookup.
     */
    readonly apiUrl: string;
    /**
     * Active UI locale, forwarded as the `locale` field in subscribe
     * payloads and used to build the redirect target for guest signups.
     */
    readonly locale: SupportedLocale;
}

// ---------------------------------------------------------------------------
// /auth/me resolution (shared cache with UserMenu)
// ---------------------------------------------------------------------------

const AUTH_ME_CACHE_TTL_MS = 60 * 1000;

/**
 * Shape of the cached `/auth/me` snapshot. Only the fields this island
 * needs are typed — UserMenu writes a richer object but the parse is
 * structural, so extra fields are ignored.
 */
interface AuthMeCacheSnapshot {
    readonly isAuthenticated: boolean;
    readonly user: { readonly id?: string; readonly email?: string } | null;
    readonly cachedAt: number;
}

interface ResolvedAuth {
    readonly isAuthenticated: boolean;
    readonly email: string;
}

function readAuthMeFromCache(): ResolvedAuth | null {
    try {
        const raw = sessionStorage.getItem(AUTH_ME_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as AuthMeCacheSnapshot;
        if (Date.now() - parsed.cachedAt > AUTH_ME_CACHE_TTL_MS) return null;
        return {
            isAuthenticated: parsed.isAuthenticated === true,
            email: parsed.user?.email ?? ''
        };
    } catch {
        return null;
    }
}

async function fetchAuthMe(apiUrl: string, signal: AbortSignal): Promise<ResolvedAuth> {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1/public/auth/me`, {
        credentials: 'include',
        signal
    });
    if (!response.ok) {
        return { isAuthenticated: false, email: '' };
    }
    const json = (await response.json()) as {
        data?: {
            actor?: { email?: string };
            isAuthenticated?: boolean;
        };
    };
    const isAuthenticated = json.data?.isAuthenticated === true;
    return {
        isAuthenticated,
        email: isAuthenticated ? (json.data?.actor?.email ?? '') : ''
    };
}

// ---------------------------------------------------------------------------
// Analytics helper
// ---------------------------------------------------------------------------

/**
 * Push a single event to `window.dataLayer` if it is available.
 * Never throws — gracefully degrades when GTM is not loaded.
 */
function pushDataLayerEvent(event: string, properties?: Record<string, unknown>): void {
    try {
        // TYPE-WORKAROUND: GTM injects window.dataLayer at runtime when the script loads; the DOM Window type doesn't include it, so we widen here. Wrapped in try/catch so missing GTM degrades silently.
        const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
        if (Array.isArray(dl)) {
            dl.push({ event, ...properties });
        }
    } catch {
        // dataLayer not available — silently skip
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * NewsletterForm island — replaces the static footer subscribe form.
 *
 * Renders a controlled subscribe form with 6 distinct visual states and
 * full keyboard / screen-reader accessibility.
 *
 * @example
 * ```astro
 * <NewsletterForm
 *   isAuthenticated={!!user}
 *   userEmail={user?.email}
 *   apiUrl={import.meta.env.PUBLIC_API_URL}
 *   locale={locale}
 *   client:visible
 * />
 * ```
 */
export function NewsletterForm({
    isAuthenticated,
    userEmail = '',
    apiUrl,
    locale
}: NewsletterFormProps) {
    const { t } = createTranslations(locale);

    // Stable IDs for aria associations
    const emailLabelId = useId();
    const statusRegionId = useId();
    const consentNoteId = useId();

    // Email value typed by a guest visitor. Authenticated visitors don't use
    // this — their input is read-only and bound to `resolvedEmail`.
    const [guestEmail, setGuestEmail] = useState<string>('');

    // Resolved client-side email for AUTHED visitors. Seeded from the SSR-
    // provided prop so the first paint matches the server, then overridden
    // after hydration by the cached `/auth/me` snapshot (or a fresh fetch).
    const [resolvedEmail, setResolvedEmail] = useState<string>(userEmail);

    // Determine the initial state synchronously from the props so the first
    // paint (before any effect runs) is already correct on session-aware routes.
    const [formState, setFormState] = useState<FormState>(
        isAuthenticated ? 'idle-auth' : 'idle-guest'
    );

    // Whether the visitor is authenticated. This is the stable "mode" of the
    // form (guest vs authed), separate from `formState` which tracks progress
    // (idle/pending/error/...). We need it explicitly because `error` and
    // `pending` are reachable from BOTH modes, and the render must know which
    // input to show. Seeded from the SSR prop, re-resolved on mount.
    const [isAuthed, setIsAuthed] = useState<boolean>(isAuthenticated);

    // Inline error message for the error state
    const [errorMessage, setErrorMessage] = useState<string>('');

    // Label for the aria-live status region
    const [statusText, setStatusText] = useState<string>('');

    // Whether we need to use alreadyPendingMessage (vs pendingMessage) when in pending-verification state
    const [wasAlreadyPending, setWasAlreadyPending] = useState<boolean>(false);

    // Resolve auth state client-side, then fetch the subscription status if
    // the resolved state is authenticated. We deliberately do NOT depend on
    // the SSR-provided props beyond the initial seed because the props are
    // unreliable on routes outside SESSION_OPTIONAL_SEGMENTS.
    // biome-ignore lint/correctness/useExhaustiveDependencies: single-shot mount effect; apiUrl is stable after hydration
    useEffect(() => {
        const controller = new AbortController();

        const resolveAndCheck = async (): Promise<void> => {
            // 1. Resolve auth state: prefer the shared /auth/me cache; fall back to a fresh fetch.
            let auth = readAuthMeFromCache();
            if (!auth) {
                try {
                    auth = await fetchAuthMe(apiUrl, controller.signal);
                } catch {
                    // Network error or abort — keep whatever we already have from props.
                    return;
                }
            }

            if (controller.signal.aborted) return;

            setIsAuthed(auth.isAuthenticated);
            setResolvedEmail(auth.email);

            // 2. If the resolved state is guest, snap the form to idle-guest.
            //    (Covers the rare case where SSR thought the user was authed
            //    but the session expired between SSR and hydration.)
            if (!auth.isAuthenticated) {
                setFormState((current) =>
                    current === 'pending-verification' || current === 'already-active'
                        ? current
                        : 'idle-guest'
                );
                return;
            }

            // 3. If the resolved state is authed but the form was painted as
            //    guest (because the server-side hint was wrong), promote it.
            setFormState((current) => (current === 'idle-guest' ? 'idle-auth' : current));

            // 4. Fetch the current subscription status. Authenticated callers only.
            try {
                const response = await fetch(
                    `${apiUrl.replace(/\/$/, '')}/api/v1/protected/newsletter/status`,
                    {
                        credentials: 'include',
                        signal: controller.signal
                    }
                );

                if (!response.ok || controller.signal.aborted) return;

                const body = (await response.json()) as StatusResponse;

                if (body.status === 'active') {
                    setFormState('already-active');
                    return;
                }

                if (body.status === 'pending_verification') {
                    setWasAlreadyPending(true);
                    setFormState('pending-verification');
                    return;
                }

                // status is null | 'unsubscribed' | 'bounced' | 'complained' → show the subscribe form
                setFormState('idle-auth');
            } catch {
                // Network error or abort — remain in idle-auth so the user can try to subscribe
            }
        };

        void resolveAndCheck();

        return () => {
            controller.abort();
        };
    }, []); // intentionally empty — single-shot on mount

    // ---------------------------------------------------------------------------
    // Event handlers
    // ---------------------------------------------------------------------------

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        if (formState !== 'idle-guest' && formState !== 'idle-auth') return;

        const isGuest = formState === 'idle-guest';

        // Guest path: light client-side email validation before the round-trip
        // so an obviously-invalid typo doesn't burn the IP's rate-limit budget
        // (3 req/min on the public endpoint).
        if (isGuest) {
            const trimmed = guestEmail.trim();
            const isPlausibleEmail =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && trimmed.length <= 255;
            if (!isPlausibleEmail) {
                const msg = t('footer.newsletter.invalidEmail', 'Ingresá un email válido.');
                setErrorMessage(msg);
                setStatusText(msg);
                setFormState('error');
                return;
            }
        }

        pushDataLayerEvent('newsletter_subscribe_clicked', { auth: !isGuest });

        setFormState('pending');
        setStatusText(t('footer.newsletter.loadingText', 'Enviando...'));
        setErrorMessage('');

        const endpoint = isGuest
            ? `${apiUrl.replace(/\/$/, '')}/api/v1/public/newsletter/subscribe`
            : `${apiUrl.replace(/\/$/, '')}/api/v1/protected/newsletter/subscribe`;
        const body = isGuest
            ? JSON.stringify({
                  email: guestEmail.trim(),
                  locale,
                  source: 'web_footer'
              })
            : JSON.stringify({
                  locale,
                  source: 'web_footer'
              });

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body
            });

            if (!response.ok) {
                // Try to parse the error envelope so we can branch on the
                // service-level reason. A malformed body still lands in the
                // generic error banner below.
                let reason: string | undefined;
                try {
                    const errBody = (await response.json()) as ApiErrorResponse;
                    reason = errBody?.error?.reason;
                } catch {
                    // Body wasn't JSON — fall through to the generic error.
                }

                if (!isGuest && reason === 'NEWSLETTER_ACCOUNT_EMAIL_UNVERIFIED') {
                    setFormState('blocked-unverified');
                    setStatusText(
                        t(
                            'footer.newsletter.blockedUnverifiedMessage',
                            'Verificá el email de tu cuenta antes de suscribirte al newsletter.'
                        )
                    );
                    return;
                }

                const msg = t(
                    'footer.newsletter.errorMessage',
                    'No pudimos procesar tu suscripción. Intentá de nuevo.'
                );
                setErrorMessage(msg);
                setStatusText(msg);
                setFormState('error');
                return;
            }

            const payload = (await response.json()) as SubscribeResponse;

            // Guest path always redirects to the dedicated confirma-tu-email
            // page. We treat `pending_verification` and `already_pending`
            // identically — both mean "we sent an email, go check". An
            // `'active'` response (the email is somehow already subscribed)
            // surfaces inline as the already-active banner.
            if (isGuest) {
                if (payload.status === 'active') {
                    setFormState('already-active');
                    return;
                }
                pushDataLayerEvent('newsletter_subscribe_success', {
                    locale,
                    auth: false,
                    status: payload.status
                });
                trackEvent(WebEvents.NewsletterSubscribed, {
                    source: 'footer',
                    locale,
                    auth: false
                });
                const trimmed = guestEmail.trim();
                const target = `/${locale}/newsletter/confirma-tu-email?email=${encodeURIComponent(trimmed)}`;
                if (typeof window !== 'undefined') {
                    window.location.assign(target);
                }
                // While the navigation lands, keep the form in a stable banner
                // state so the brief flicker before the redirect doesn't show
                // the form again.
                setWasAlreadyPending(payload.status === 'already_pending');
                setFormState('pending-verification');
                return;
            }

            // Authed path retains the in-place transitions.
            if (payload.status === 'already_pending') {
                setWasAlreadyPending(true);
                setStatusText(
                    t(
                        'footer.newsletter.alreadyPendingMessage',
                        'Ya enviamos un email de confirmación. Revisá tu bandeja de entrada o spam.'
                    )
                );
                setFormState('pending-verification');
                return;
            }

            if (payload.status === 'active') {
                setFormState('already-active');
                pushDataLayerEvent('newsletter_subscribe_success', {
                    locale,
                    auth: true,
                    status: 'active'
                });
                trackEvent(WebEvents.NewsletterSubscribed, {
                    source: 'footer',
                    locale,
                    auth: true
                });
                return;
            }

            // status === 'pending_verification'
            setStatusText(
                t(
                    'footer.newsletter.pendingMessage',
                    'Revisá tu email para confirmar tu suscripción.'
                )
            );
            setFormState('pending-verification');
            pushDataLayerEvent('newsletter_subscribe_success', {
                locale,
                auth: true,
                status: 'pending_verification'
            });
            trackEvent(WebEvents.NewsletterSubscribed, { source: 'footer', locale, auth: true });
        } catch {
            const msg = t(
                'footer.newsletter.errorMessage',
                'No pudimos procesar tu suscripción. Intentá de nuevo.'
            );
            setErrorMessage(msg);
            setStatusText(msg);
            setFormState('error');
        }
    };

    /**
     * Inline unsubscribe from the already-active banner.
     *
     * Uses `window.confirm` for the "are you sure?" prompt — keeps the
     * footer-island bundle small and matches the simpler patterns elsewhere
     * in the app (e.g. CollectionDetailActions). On confirmation, DELETE
     * /api/v1/protected/newsletter/unsubscribe; on success, the form snaps
     * back to `idle-auth` so the visitor can re-subscribe without a reload.
     */
    const handleInlineUnsubscribe = async (): Promise<void> => {
        if (formState !== 'already-active') return;
        if (typeof window === 'undefined') return;

        const confirmed = window.confirm(
            t(
                'footer.newsletter.unsubscribeConfirm',
                '¿Confirmás que querés desuscribirte del newsletter?'
            )
        );
        if (!confirmed) return;

        setFormState('unsubscribing');
        setStatusText(t('footer.newsletter.loadingText', 'Enviando...'));
        setErrorMessage('');

        try {
            const response = await fetch(
                `${apiUrl.replace(/\/$/, '')}/api/v1/protected/newsletter/unsubscribe`,
                {
                    method: 'DELETE',
                    credentials: 'include'
                }
            );
            if (!response.ok) {
                const msg = t(
                    'footer.newsletter.unsubscribeError',
                    'No pudimos desuscribirte. Probá de nuevo en unos minutos.'
                );
                setErrorMessage(msg);
                setStatusText(msg);
                setFormState('already-active');
                return;
            }
            setStatusText(
                t('footer.newsletter.unsubscribeSuccess', 'Te desuscribiste del newsletter.')
            );
            // Drop back to idle-auth so a returning visitor can subscribe
            // again without reloading the page.
            setFormState('idle-auth');
            pushDataLayerEvent('newsletter_unsubscribe_success', {
                locale,
                source: 'footer'
            });
        } catch {
            const msg = t(
                'footer.newsletter.unsubscribeError',
                'No pudimos desuscribirte. Probá de nuevo en unos minutos.'
            );
            setErrorMessage(msg);
            setStatusText(msg);
            setFormState('already-active');
        }
    };

    // ---------------------------------------------------------------------------
    // Render helpers
    // ---------------------------------------------------------------------------

    const isLoading = formState === 'pending';
    const isUnsubscribing = formState === 'unsubscribing';
    const managePath = `/${locale}/mi-cuenta/newsletter/`;

    // ---------------------------------------------------------------------------
    // Return: already-active banner
    // ---------------------------------------------------------------------------

    if (formState === 'already-active' || formState === 'unsubscribing') {
        return (
            <div
                className={styles.banner}
                data-state="already-active"
            >
                <span
                    className={styles.bannerIcon}
                    aria-hidden="true"
                >
                    ✓
                </span>
                <p className={styles.bannerText}>
                    {t('footer.newsletter.alreadySubscribed', 'Ya estás suscripto.')}
                </p>
                <div className={styles.bannerActions}>
                    <a
                        href={managePath}
                        className={styles.manageLink}
                    >
                        {t('footer.newsletter.manageLink', 'Gestionar suscripción')}
                    </a>
                    <button
                        type="button"
                        className={styles.unsubscribeButton}
                        onClick={() => {
                            void handleInlineUnsubscribe();
                        }}
                        disabled={isUnsubscribing}
                        aria-busy={isUnsubscribing}
                    >
                        {isUnsubscribing
                            ? t('footer.newsletter.unsubscribeBusy', 'Desuscribiendo...')
                            : t('footer.newsletter.unsubscribeCta', 'Desuscribirme')}
                    </button>
                </div>
            </div>
        );
    }

    // ---------------------------------------------------------------------------
    // Return: blocked-unverified banner (authed user, account email not verified)
    // ---------------------------------------------------------------------------

    if (formState === 'blocked-unverified') {
        return (
            <div
                className={styles.banner}
                data-state="blocked-unverified"
                aria-live="polite"
            >
                <span
                    className={styles.bannerIcon}
                    aria-hidden="true"
                >
                    ⚠
                </span>
                <p className={styles.bannerText}>
                    {t(
                        'footer.newsletter.blockedUnverifiedMessage',
                        'Verificá el email de tu cuenta antes de suscribirte al newsletter.'
                    )}
                </p>
                <a
                    href={`/${locale}/mi-cuenta/`}
                    className={styles.manageLink}
                >
                    {t('footer.newsletter.blockedUnverifiedCta', 'Ir a mi cuenta')}
                </a>
            </div>
        );
    }

    // ---------------------------------------------------------------------------
    // Return: pending-verification banner
    // ---------------------------------------------------------------------------

    if (formState === 'pending-verification') {
        const message = wasAlreadyPending
            ? t(
                  'footer.newsletter.alreadyPendingMessage',
                  'Ya enviamos un email de confirmación. Revisá tu bandeja de entrada o spam.'
              )
            : t(
                  'footer.newsletter.pendingMessage',
                  'Revisá tu email para confirmar tu suscripción.'
              );

        return (
            <div
                className={styles.banner}
                data-state="pending-verification"
                aria-live="polite"
            >
                <span
                    className={styles.bannerIcon}
                    aria-hidden="true"
                >
                    ✉
                </span>
                <p className={styles.bannerText}>{message}</p>
            </div>
        );
    }

    // ---------------------------------------------------------------------------
    // Return: form (idle-guest | idle-auth | pending | error)
    // ---------------------------------------------------------------------------

    return (
        <div className={styles.wrapper}>
            {/* aria-live region: polite announcements for loading / error / success */}
            <p
                id={statusRegionId}
                className={styles.srOnly}
                aria-live="polite"
                aria-atomic="true"
            >
                {statusText}
            </p>

            {/* Visually hidden label — accessible to screen readers */}
            <label
                id={emailLabelId}
                className={styles.srOnly}
                htmlFor={`${emailLabelId}-input`}
            >
                {t('footer.newsletter.title', 'Suscribite al newsletter')}
            </label>

            <form
                className={styles.form}
                aria-label={t('footer.newsletter.title', 'Suscribite al newsletter')}
                onSubmit={(event) => {
                    void handleSubmit(event);
                }}
                aria-describedby={consentNoteId}
                aria-busy={isLoading}
                noValidate
            >
                <div className={styles.inputRow}>
                    {/* Email input */}
                    <div className={styles.inputWrapper}>
                        {isAuthed ? (
                            // Authenticated / in-flight / error: controlled read-only input
                            <input
                                id={`${emailLabelId}-input`}
                                type="email"
                                className={styles.emailInput}
                                value={resolvedEmail}
                                placeholder={resolvedEmail}
                                readOnly
                                disabled={isLoading}
                                aria-labelledby={emailLabelId}
                                aria-invalid={formState === 'error' ? 'true' : 'false'}
                                autoComplete="email"
                                onChange={() => {
                                    // readOnly — no change handler needed; required to suppress React warning
                                }}
                            />
                        ) : (
                            // Guest: editable controlled input. The visitor types
                            // their email here and the form submits to the public
                            // endpoint, which then redirects to confirma-tu-email.
                            // Editable across idle-guest AND error so a guest who
                            // mistyped can correct and retry (BETA-25).
                            <input
                                id={`${emailLabelId}-input`}
                                type="email"
                                className={styles.emailInput}
                                value={guestEmail}
                                onChange={(event) => {
                                    setGuestEmail(event.currentTarget.value);
                                    if (formState === 'error') {
                                        // Recover from the error state on the next
                                        // keystroke so the guest can resubmit.
                                        setErrorMessage('');
                                        setFormState('idle-guest');
                                    }
                                }}
                                placeholder={t('footer.newsletter.emailPlaceholder', 'Tu email')}
                                aria-labelledby={emailLabelId}
                                aria-invalid="false"
                                autoComplete="email"
                                inputMode="email"
                                disabled={isLoading}
                                required
                            />
                        )}
                    </div>

                    {/* Submit button — always type=submit now that guests
                        also submit (the public POST + redirect path). */}
                    <button
                        type="submit"
                        className={styles.submitButton}
                        disabled={isLoading}
                        aria-busy={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <span
                                    className={styles.spinner}
                                    aria-hidden="true"
                                />
                                <span className={styles.srOnly}>
                                    {t('footer.newsletter.loadingText', 'Enviando...')}
                                </span>
                            </>
                        ) : (
                            t('footer.newsletter.subscribeButton', 'Suscribirme')
                        )}
                    </button>
                </div>

                {/* Inline error — shown only in error state */}
                {formState === 'error' && errorMessage && (
                    <p
                        className={styles.errorMessage}
                        role="alert"
                    >
                        {errorMessage}
                    </p>
                )}

                {/* Consent note — referenced by aria-describedby */}
                <p
                    id={consentNoteId}
                    className={styles.consentNote}
                >
                    {t(
                        'footer.newsletter.consentNote',
                        'Al suscribirte aceptás recibir nuestro newsletter y métricas de entrega básicas.'
                    )}
                </p>
            </form>
        </div>
    );
}
