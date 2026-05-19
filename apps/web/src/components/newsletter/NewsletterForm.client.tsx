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
 * Authentication decision: `isAuthenticated` and `userEmail` are resolved by the Astro Footer
 * layer from `Astro.locals` and passed as props. The island does NOT call Better Auth directly.
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

    // Determine the initial state synchronously from the props so the first
    // paint (before any effect runs) is already correct.
    const [formState, setFormState] = useState<FormState>(
        isAuthenticated ? 'idle-auth' : 'idle-guest'
    );

    // Inline error message for the error state
    const [errorMessage, setErrorMessage] = useState<string>('');

    // Label for the aria-live status region
    const [statusText, setStatusText] = useState<string>('');

    // Whether we need to use alreadyPendingMessage (vs pendingMessage) when in pending-verification state
    const [wasAlreadyPending, setWasAlreadyPending] = useState<boolean>(false);

    // Fetch subscription status on mount (authenticated users only).
    // Guest users never call this endpoint.
    // biome-ignore lint/correctness/useExhaustiveDependencies: single-shot mount effect; isAuthenticated/apiUrl don't change after hydration
    useEffect(() => {
        if (!isAuthenticated) return;

        const controller = new AbortController();

        const checkStatus = async (): Promise<void> => {
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

        void checkStatus();

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
                            // Guest: uncontrolled editable input. The form is intercepted
                            // before submission so we never read this value.
                            <input
                                id={`${emailLabelId}-input`}
                                type="email"
                                className={styles.emailInput}
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
                                value={userEmail}
                                placeholder={userEmail}
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
