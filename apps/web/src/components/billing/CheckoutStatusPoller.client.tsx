/**
 * @file CheckoutStatusPoller.client.tsx
 * @description Checkout success-page polling island (HOS-151 Bug A).
 *
 * A recurring MercadoPago preapproval redirect back to the checkout success
 * page carries NO `collection_status`, so the page cannot render a final
 * success/failure state server-side — the subscription may still be flipping
 * from `pending_provider` to `active` via the webhook (or the polling-fallback
 * cron). Before the fix the page rendered a one-shot "Verificando estado del
 * pago..." and hung there forever.
 *
 * This island reads the `localSubscriptionId` that `PlanPurchaseButton` stashed
 * in sessionStorage before the redirect and polls
 * `GET /billing/subscriptions/:localId/status` every ~2s. On `active` it swaps
 * to the success state; after a bounded timeout (~90s) it degrades to an
 * explicit, non-alarming fallback pointing at the account page — it never spins
 * forever.
 *
 * Hydration: client:load — the user is staring at this page waiting for a
 * result, so it must start polling immediately.
 */

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { billingApi } from '../../lib/api/endpoints-protected';
import {
    clearPendingCheckoutSubId,
    readPendingCheckoutSubId
} from '../../lib/billing/checkout-pending';
import type { SupportedLocale } from '../../lib/i18n';
import { createTranslations } from '../../lib/i18n';
import styles from './CheckoutStatusPoller.module.css';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Delay between status polls. */
const POLL_INTERVAL_MS = 2000;

/**
 * Maximum number of poll attempts before falling back. 45 attempts × 2s ≈ 90s,
 * comfortably longer than the webhook/polling-cron confirmation window while
 * still bounded so the page never spins forever (R-1).
 */
const MAX_ATTEMPTS = 45;

/**
 * Subscription statuses that mean the checkout succeeded. `active` is the
 * canonical activated state for a paid preapproval; `trialing` / `comp` are
 * accepted defensively (they resolve on the in-app sentinel path, not here, but
 * matching them costs nothing and future-proofs the poller).
 */
const SUCCESS_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing', 'comp']);

type PollerState = 'verifying' | 'success' | 'timeout';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CheckoutStatusPollerProps {
    /** Current locale for translated copy. */
    readonly locale: SupportedLocale;
    /** Locale-aware `/mi-cuenta` URL for the success + fallback CTAs. */
    readonly miCuentaUrl: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CheckoutStatusPoller — polls the subscription status endpoint until the paid
 * subscription activates (or a timeout is reached), rendering verifying →
 * success / fallback states in place.
 */
export function CheckoutStatusPoller({
    locale,
    miCuentaUrl
}: CheckoutStatusPollerProps): JSX.Element {
    const { t } = createTranslations(locale);
    const [state, setState] = useState<PollerState>('verifying');

    useEffect(() => {
        const localId = readPendingCheckoutSubId();

        // No pending checkout id (direct navigation, a refresh after the id was
        // already cleared, or storage unavailable) — there is nothing to poll,
        // so degrade straight to the non-alarming fallback that points at the
        // account page rather than spinning.
        if (!localId) {
            setState('timeout');
            return;
        }

        let cancelled = false;
        let attempts = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const poll = async (): Promise<void> => {
            if (cancelled) {
                return;
            }
            attempts += 1;

            try {
                const result = await billingApi.getSubscriptionStatus({ localId });
                if (cancelled) {
                    return;
                }
                if (result.ok && SUCCESS_STATUSES.has(result.data.status)) {
                    clearPendingCheckoutSubId();
                    setState('success');
                    return;
                }
            } catch {
                // Transient network/API error — keep polling until the timeout.
            }

            if (cancelled) {
                return;
            }
            if (attempts >= MAX_ATTEMPTS) {
                clearPendingCheckoutSubId();
                setState('timeout');
                return;
            }
            timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
        };

        // First attempt fires immediately; the subscription is often already
        // active by the time MP redirects back.
        void poll();

        return () => {
            cancelled = true;
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, []);

    const copy = ((): { title: string; body: string; showCta: boolean } => {
        if (state === 'success') {
            return {
                title: t('billing.checkout.success.title', '¡Tu suscripción está activa!'),
                body: t('billing.checkout.success.subtitle', 'Tu pago fue aprobado correctamente'),
                showCta: true
            };
        }
        if (state === 'timeout') {
            return {
                title: t('billing.checkout.success.timeoutTitle', 'Está tardando más de lo normal'),
                body: t(
                    'billing.checkout.success.timeoutSubtitle',
                    'El pago puede seguir procesándose. Revisá tu cuenta en unos minutos para confirmar tu suscripción.'
                ),
                showCta: true
            };
        }
        return {
            title: t('billing.checkout.success.verifyingStatus', 'Verificando estado del pago...'),
            body: t(
                'billing.checkout.success.verifyingSubtitle',
                'Estamos confirmando tu pago. Esto puede tardar unos instantes.'
            ),
            showCta: false
        };
    })();

    const ctaLabel = t('billing.checkout.success.cta', 'Ir a mi cuenta');

    return (
        <section
            className={styles.result}
            aria-live="polite"
            aria-busy={state === 'verifying'}
        >
            <div className={styles.container}>
                <div
                    className={`${styles.icon} ${
                        state === 'success'
                            ? styles.iconSuccess
                            : state === 'timeout'
                              ? styles.iconTimeout
                              : styles.iconVerifying
                    }`}
                    aria-hidden="true"
                >
                    {state === 'verifying' ? (
                        <span
                            className={styles.spinner}
                            aria-hidden="true"
                        />
                    ) : (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 64 64"
                            fill="none"
                            width="80"
                            height="80"
                            aria-hidden="true"
                        >
                            <circle
                                cx="32"
                                cy="32"
                                r="30"
                                stroke="currentColor"
                                stroke-width="4"
                            />
                            {state === 'success' ? (
                                <path
                                    d="M20 32l9 9 15-18"
                                    stroke="currentColor"
                                    stroke-width="4"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            ) : (
                                <path
                                    d="M32 18v14l9 6"
                                    stroke="currentColor"
                                    stroke-width="4"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            )}
                        </svg>
                    )}
                </div>

                <h1 className={styles.title}>{copy.title}</h1>
                <p className={styles.body}>{copy.body}</p>

                {copy.showCta && (
                    <div className={styles.actions}>
                        <a
                            href={miCuentaUrl}
                            className={styles.cta}
                        >
                            {ctaLabel}
                        </a>
                    </div>
                )}
            </div>
        </section>
    );
}
