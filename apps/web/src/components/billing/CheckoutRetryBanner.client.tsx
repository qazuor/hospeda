/**
 * @file CheckoutRetryBanner.client.tsx
 * @description Subscription-page banner that resolves a checkout-retry link
 * (HOS-937 step 4, spec §6.4/§8.3).
 *
 * When MercadoPago cancels a preapproval over a card rejection, the
 * cancellation webhook (`routes/webhooks/mercadopago/subscription-logic.ts`,
 * spec §6.5) emails the user a link to
 * `{siteUrl}/{lang}/mi-cuenta/suscripcion/?retryCheckoutId=<localSubscriptionId>`
 * (`buildCheckoutRetryLandingUrl`). Before this component that link landed on
 * the subscription page and did nothing with the parameter — the user opened
 * the email, clicked through, and found nothing waiting for them.
 *
 * This banner reads `retryCheckoutId` — parsed SERVER-SIDE by the Astro page
 * from the query string and passed down as a prop, never re-read from
 * `window.location` (which `StripCheckoutReturnParams` scrubs synchronously
 * in `head-early`, before this island hydrates, mirroring the HOS-209
 * `preapproval_id` pattern) — and resolves it against
 * `POST /billing/subscriptions/:localId/checkout-retry`
 * (`billingApi.checkoutRetry`, `apps/api/src/routes/billing/checkout-retry.ts`).
 *
 * The endpoint's `recovery` classification drives four DIFFERENT outcomes —
 * collapsing any two of them is the exact bug this closes:
 * - `'authorized'` — the subscription is ALREADY active. Never redirect to
 *   pay again; charging a user twice is the failure mode the whole design
 *   (spec §6.4) exists to prevent.
 * - `'pending'` / `'cancelled'` with a `checkoutUrl` — redirect the browser
 *   there. The endpoint has already decided whether that is the SAME
 *   preapproval (`pending`) or a FRESH one it just minted (`cancelled`); this
 *   component only follows the link.
 * - `'confirming'` — a concurrent claim (another tab, the same email link
 *   opened twice) is resolving the same recovery right now, or the deferred
 *   re-read (spec §10 R-3) was genuinely ambiguous. Retried a bounded number
 *   of times on the existing checkout-poll backoff schedule, then a manual
 *   retry is offered — never an unbounded loop.
 *
 * One click, one attempt: a ref keyed by `retryNonce` guarantees the effect
 * dispatches at most one network call per nonce even under React's dev-mode
 * double-invoke, and `StripCheckoutReturnParams` (mounted by the page) scrubs
 * `retryCheckoutId` from the visible URL before this island hydrates — a
 * manual page reload therefore no longer carries the parameter and cannot
 * trigger a second attempt on its own. The server-side compare-and-set (spec
 * §6.6 mechanism C) is the backstop for a genuinely concurrent request (two
 * tabs opened from the same email link); this guard is the front-end's own
 * half of "one click, one attempt", not a replacement for it.
 *
 * Hydration: client:load — a user arriving from the rejection email should
 * not have to scroll or wait for idle time to find out what happened.
 */

import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { billingApi } from '../../lib/api/endpoints-protected';
import { nextPollDelayMs } from '../../lib/billing/checkout-poll-schedule';
import type { SupportedLocale } from '../../lib/i18n';
import { createTranslations } from '../../lib/i18n';
import styles from './CheckoutRetryBanner.module.css';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Attempts allowed while the endpoint reports `'confirming'` before this
 * banner stops auto-retrying and offers a manual retry button instead.
 * Deliberately much smaller than `CHECKOUT_POLL_MAX_ATTEMPTS`
 * (`checkout-poll-schedule.ts`, ~3 minutes budget for the checkout-success
 * poll): a claim race or a deferred-confirmation ambiguity resolves in
 * seconds, not minutes.
 */
const CONFIRMING_MAX_ATTEMPTS = 5;

type BannerState =
    | 'checking'
    | 'redirecting'
    | 'active'
    | 'confirming'
    | 'confirmingTimedOut'
    | 'error';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CheckoutRetryBannerProps {
    /** Current locale for translated copy. */
    readonly locale: SupportedLocale;
    /**
     * Local subscription UUID read server-side from `?retryCheckoutId=`
     * (`buildCheckoutRetryLandingUrl`). `null` when the page was opened
     * without that parameter — the banner then renders nothing, exactly
     * matching the page's behavior before this component existed.
     */
    readonly retryCheckoutId: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CheckoutRetryBanner — resolves a `?retryCheckoutId=` link into one of the
 * spec §6.4 recoveries, redirecting or informing the user in place.
 */
export function CheckoutRetryBanner({
    locale,
    retryCheckoutId
}: CheckoutRetryBannerProps): JSX.Element | null {
    const { t } = createTranslations(locale);
    const [state, setState] = useState<BannerState>('checking');
    const [retryNonce, setRetryNonce] = useState(0);
    const dispatchedNonceRef = useRef<number | null>(null);

    useEffect(() => {
        if (!retryCheckoutId) {
            return;
        }
        // Guards against React's dev-mode double-invoke calling this twice
        // for the SAME nonce (mount → cleanup → mount). A genuine manual
        // retry bumps `retryNonce`, which never matches the already-recorded
        // value, so it always re-dispatches exactly once.
        if (dispatchedNonceRef.current === retryNonce) {
            return;
        }
        dispatchedNonceRef.current = retryNonce;

        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const resolve = async (attempt: number): Promise<void> => {
            const result = await billingApi.checkoutRetry({ localId: retryCheckoutId });
            if (cancelled) {
                return;
            }
            if (!result.ok) {
                setState('error');
                return;
            }

            const { recovery, checkoutUrl } = result.data;

            if (recovery === 'authorized') {
                setState('active');
                return;
            }

            if ((recovery === 'pending' || recovery === 'cancelled') && checkoutUrl) {
                setState('redirecting');
                window.location.href = checkoutUrl;
                return;
            }

            // `recovery === 'confirming'`, or a pending/cancelled read that
            // came back with no `checkoutUrl` yet (unexpected but not fatal —
            // treat it like a transient confirmation, not a hard error).
            if (attempt >= CONFIRMING_MAX_ATTEMPTS) {
                setState('confirmingTimedOut');
                return;
            }
            setState('confirming');
            timer = setTimeout(() => void resolve(attempt + 1), nextPollDelayMs({ attempt }));
        };

        void resolve(1);

        return () => {
            cancelled = true;
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [retryCheckoutId, retryNonce]);

    if (!retryCheckoutId) {
        return null;
    }

    /** Manual retry from a terminal non-success state — one click, one attempt. */
    const handleManualRetry = (): void => {
        setState('checking');
        setRetryNonce((n) => n + 1);
    };

    const isBusy = state === 'checking' || state === 'confirming' || state === 'redirecting';

    const copy = ((): { title: string; body: string } => {
        if (state === 'active') {
            return {
                title: t('billing.checkoutRetry.activeTitle', 'Tu suscripción ya está activa'),
                body: t(
                    'billing.checkoutRetry.activeBody',
                    'No hace falta que vuelvas a pagar: tu plan ya está funcionando.'
                )
            };
        }
        if (state === 'redirecting') {
            return {
                title: t(
                    'billing.checkoutRetry.redirectingTitle',
                    'Te estamos redirigiendo a Mercado Pago...'
                ),
                body: t(
                    'billing.checkoutRetry.redirectingBody',
                    'Un momento, te llevamos a completar el pago.'
                )
            };
        }
        if (state === 'confirming') {
            return {
                title: t('billing.checkoutRetry.confirmingTitle', 'Estamos confirmando tu pago'),
                body: t(
                    'billing.checkoutRetry.confirmingBody',
                    'Puede que ya lo estemos resolviendo desde otra pestaña. Esperá un momento.'
                )
            };
        }
        if (state === 'confirmingTimedOut') {
            return {
                title: t(
                    'billing.checkoutRetry.confirmingTimedOutTitle',
                    'Todavía estamos confirmando tu pago'
                ),
                body: t(
                    'billing.checkoutRetry.confirmingTimedOutBody',
                    'Esto está tardando más de lo esperado. Podés intentarlo de nuevo en un momento.'
                )
            };
        }
        if (state === 'error') {
            return {
                title: t('billing.checkoutRetry.errorTitle', 'No pudimos verificar tu pago'),
                body: t(
                    'billing.checkoutRetry.errorBody',
                    'Volvé a intentarlo o escribinos si el problema sigue.'
                )
            };
        }
        return {
            title: t('billing.checkoutRetry.checkingTitle', 'Verificando tu pago...'),
            body: t(
                'billing.checkoutRetry.checkingBody',
                'Estamos revisando el estado de tu suscripción.'
            )
        };
    })();

    const showRetryButton = state === 'confirmingTimedOut' || state === 'error';

    return (
        <section
            className={`${styles.banner} ${state === 'error' ? styles.bannerError : state === 'active' ? styles.bannerSuccess : ''}`}
            aria-live="polite"
            aria-busy={isBusy}
        >
            {isBusy && (
                <span
                    className={styles.spinner}
                    aria-hidden="true"
                />
            )}
            <div className={styles.text}>
                <h2 className={styles.title}>{copy.title}</h2>
                <p className={styles.body}>{copy.body}</p>
            </div>
            {showRetryButton && (
                <button
                    type="button"
                    className={styles.retryButton}
                    onClick={handleManualRetry}
                >
                    {t('billing.checkoutRetry.retryButton', 'Reintentar')}
                </button>
            )}
        </section>
    );
}
