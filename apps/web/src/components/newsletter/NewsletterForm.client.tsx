/**
 * @file NewsletterForm.client.tsx
 * @description React island replacing the static footer newsletter form.
 *
 * Implements the 6 visual states from SPEC-101 §5.1:
 * - idle-guest:          Not authenticated — editable empty email, lock badge, AuthRequiredPopover on click.
 * - idle-auth:           Authenticated, not yet subscribed — email pre-filled from session, read-only.
 * - pending:             Subscription request in-flight — spinner, button disabled, aria-busy.
 * - pending-verification: Subscribe succeeded — success banner replaces form.
 * - already-active:      User is already an active subscriber — "Ya estás suscripto" banner + manage link.
 * - error:               API failure — inline error, button re-enabled.
 *
 * Authentication decision: the Astro Footer passes the server-rendered hint via the
 * `isAuthenticated` + `userEmail` props (read from `Astro.locals`). Those props are
 * accurate ONLY on routes where the middleware parses the session (protected, auth,
 * SESSION_OPTIONAL_SEGMENTS). On home, contact, legal pages, etc. `Astro.locals.user`
 * is null even when the visitor has a live cookie, so the island MUST re-resolve its
 * auth state client-side on mount via the cached `/api/v1/public/auth/me` snapshot
 * (the same cache UserMenu populates). Without this the footer always renders the
 * guest variant outside session-aware routes.
 *
 * AuthRequiredPopover: reuses the existing component from
 * `apps/web/src/components/auth/AuthRequiredPopover.client.tsx`. It satisfies all AC-101-02
 * requirements via its configurable `message`, `signInLabel`, and `registerLabel` props.
 * No new file is created; `AuthRequiredPopover.tsx` in this directory is a thin re-export
 * for backward-compat with the task file list.
 *
 * Hydration: designed for `client:visible` (lazy hydration on scroll into view).
 * SSR renders the input + button without JavaScript; hydration adds interactive behavior.
 *
 * Analytics: fires `newsletter_subscribe_clicked` and `newsletter_subscribe_success`
 * to `window.dataLayer` when available.
 */

import { AuthRequiredPopover } from '@/components/auth/AuthRequiredPopover.client';
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/posthog-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useEffect, useId, useRef, useState } from 'react';
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
    | 'error';

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
     * When false, the guest state with AuthRequiredPopover is shown.
     */
    readonly isAuthenticated: boolean;
    /**
     * The authenticated user's email address, pre-filled into the input.
     * Only meaningful when `isAuthenticated` is true.
     */
    readonly userEmail?: string;
    /**
     * Base URL of the API (e.g. "https://api.hospeda.com.ar").
     * Used to build the endpoint URLs for subscribe and status calls.
     */
    readonly apiUrl: string;
    /**
     * Active UI locale, forwarded to AuthRequiredPopover for building
     * auth page URLs and to the subscribe POST body.
     */
    readonly locale: SupportedLocale;
}

// ---------------------------------------------------------------------------
// /auth/me resolution (shared cache with UserMenu)
// ---------------------------------------------------------------------------

/**
 * sessionStorage key reused from UserMenu.client.tsx to share the `/auth/me`
 * snapshot across islands. KEEP IN SYNC with the same constant in
 * `UserMenu.client.tsx` and `AuthedPreferenceSync.client.tsx`.
 */
const AUTH_ME_CACHE_KEY = 'authMeSnapshot';
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

    // Ref to the submit button — used as the anchor for AuthRequiredPopover
    const submitButtonRef = useRef<HTMLButtonElement>(null);

    // Whether the auth popover is open (guest state only)
    const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);

    // Resolved client-side email. Seeded from the SSR-provided prop so the
    // first paint matches the server, then overridden after hydration by the
    // cached `/auth/me` snapshot (or a fresh fetch) so the input pre-fills
    // correctly on pages where the middleware does NOT parse the session
    // (home, contacto, legal, etc.). The resolved auth boolean is reflected
    // in `formState` directly (idle-guest ↔ idle-auth), so we don't keep a
    // separate piece of state for it.
    const [resolvedEmail, setResolvedEmail] = useState<string>(userEmail);

    // Determine the initial state synchronously from the props so the first
    // paint (before any effect runs) is already correct on session-aware routes.
    const [formState, setFormState] = useState<FormState>(
        isAuthenticated ? 'idle-auth' : 'idle-guest'
    );

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

    const handleGuestClick = (): void => {
        setIsPopoverOpen(true);
        pushDataLayerEvent('newsletter_subscribe_clicked', { auth: false });
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        if (formState !== 'idle-auth') return;

        pushDataLayerEvent('newsletter_subscribe_clicked', { auth: true });

        setFormState('pending');
        setStatusText(t('footer.newsletter.loadingText', 'Enviando...'));
        setErrorMessage('');

        try {
            const response = await fetch(
                `${apiUrl.replace(/\/$/, '')}/api/v1/protected/newsletter/subscribe`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        locale,
                        source: 'web_footer'
                    })
                }
            );

            if (!response.ok) {
                const msg = t(
                    'footer.newsletter.errorMessage',
                    'No pudimos procesar tu suscripción. Intentá de nuevo.'
                );
                setErrorMessage(msg);
                setStatusText(msg);
                setFormState('error');
                return;
            }

            const body = (await response.json()) as SubscribeResponse;

            if (body.status === 'already_pending') {
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

            if (body.status === 'active') {
                setFormState('already-active');
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
            pushDataLayerEvent('newsletter_subscribe_success', { locale });
            trackEvent(WebEvents.NewsletterSubscribed, { source: 'footer', locale });
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

    // ---------------------------------------------------------------------------
    // Render helpers
    // ---------------------------------------------------------------------------

    const isLoading = formState === 'pending';
    const managePath = `/${locale}/mi-cuenta/preferencias/newsletter/`;

    // ---------------------------------------------------------------------------
    // Return: already-active banner
    // ---------------------------------------------------------------------------

    if (formState === 'already-active') {
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
                <a
                    href={managePath}
                    className={styles.manageLink}
                >
                    {t('footer.newsletter.manageLink', 'Gestionar suscripción')}
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
                        {formState === 'idle-guest' && (
                            /* Lock badge for guest users */
                            <span
                                className={styles.lockBadge}
                                aria-hidden="true"
                                title={t(
                                    'footer.newsletter.guestLockLabel',
                                    'Iniciá sesión para suscribirte'
                                )}
                            >
                                🔒
                            </span>
                        )}
                        {formState === 'idle-guest' ? (
                            // Guest: controlled empty input — staying controlled across
                            // state transitions (e.g. when /auth/me promotes the visitor
                            // to idle-auth after hydration) avoids React's
                            // "uncontrolled → controlled" warning. The form is
                            // intercepted before submission so we never read this value.
                            <input
                                id={`${emailLabelId}-input`}
                                type="email"
                                className={styles.emailInput}
                                value=""
                                onChange={() => {
                                    // Guest input is decorative — focus opens the popover
                                    // and we never read the value. The handler is required
                                    // to keep the input controlled.
                                }}
                                placeholder={t('footer.newsletter.emailPlaceholder', 'Tu email')}
                                aria-labelledby={emailLabelId}
                                aria-invalid="false"
                                onFocus={() => setIsPopoverOpen(true)}
                                autoComplete="email"
                            />
                        ) : (
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
                        )}
                    </div>

                    {/* Submit button */}
                    <button
                        ref={submitButtonRef}
                        type={formState === 'idle-guest' ? 'button' : 'submit'}
                        className={styles.submitButton}
                        disabled={isLoading}
                        aria-busy={isLoading}
                        onClick={formState === 'idle-guest' ? handleGuestClick : undefined}
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

            {/* AuthRequiredPopover — shown only when a guest clicks subscribe */}
            {isPopoverOpen && formState === 'idle-guest' && (
                <AuthRequiredPopover
                    anchorRef={submitButtonRef}
                    message={t(
                        'newsletter.authPopover.message',
                        'Creá una cuenta gratuita y recibí novedades del Litoral en tu email.'
                    )}
                    dialogLabel={t(
                        'newsletter.authPopover.title',
                        'Iniciá sesión para suscribirte'
                    )}
                    signInLabel={t('newsletter.authPopover.loginLink', 'Ya tengo cuenta')}
                    registerLabel={t('newsletter.authPopover.registerCta', 'Registrarse')}
                    onClose={() => setIsPopoverOpen(false)}
                    locale={locale}
                    returnUrl={typeof window !== 'undefined' ? window.location.href : ''}
                />
            )}
        </div>
    );
}
