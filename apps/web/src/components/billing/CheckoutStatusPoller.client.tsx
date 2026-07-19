/**
 * @file CheckoutStatusPoller.client.tsx
 * @description Checkout success-page polling island (HOS-151 Bug A, HOS-191 Path C F2).
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
 * HOS-191 Path C ("share link" checkout) adds a linking step before polling
 * starts: `/start-paid` redirects straight to MercadoPago's hosted share link
 * with no local preapproval yet, so MercadoPago's own `back_url` redirect
 * carries `?preapproval_id=...`. When that param is present, the island first
 * calls `POST /billing/subscriptions/link-preapproval` to tie the real
 * preapproval to the pending local subscription:
 * - success (`linked`/`already`) — proceed straight into the normal poll below.
 * - `409` (IDOR — the preapproval belongs to someone else) — hard error, no poll.
 * - any other error (typically `422`, ambiguous/not-yet-visible) — non-fatal,
 *   the webhook fallback (F3) may complete the link server-side shortly after,
 *   so fall back to the normal poll rather than treating this as terminal.
 *
 * Idempotent by design: if the same `preapproval_id` is linked twice the server
 * replies `already` rather than erroring. Note (HOS-209): the success page now
 * scrubs `preapproval_id` from the URL on first load, so a manual RELOAD no
 * longer carries it — the reload skips the link call and goes straight to
 * polling. That is safe: the first load already performed the link, and the
 * webhook fallback (F3) plus continued polling remain the completion path.
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

/**
 * HTTP status that `billingApi.linkPreapproval` returns for a hard IDOR error
 * (the preapproval belongs to a different local subscription/user). Every
 * other error status is treated as non-fatal — see the module docstring.
 */
const LINK_PREAPPROVAL_IDOR_STATUS = 409;

type PollerState = 'verifying' | 'success' | 'timeout' | 'linkError';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CheckoutStatusPollerProps {
    /** Current locale for translated copy. */
    readonly locale: SupportedLocale;
    /** Locale-aware `/mi-cuenta` URL for the success + fallback CTAs. */
    readonly miCuentaUrl: string;
    /**
     * The MercadoPago preapproval id read from the `back_url` redirect's
     * `?preapproval_id=` query param (HOS-191 Path C). `null` when the
     * checkout return did not carry one (e.g. an already-linked recurring
     * preapproval redirect, or a direct navigation to this page) — in that
     * case the island skips straight to the normal status poll, unchanged
     * from HOS-151 behaviour.
     */
    readonly preapprovalId: string | null;
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
    miCuentaUrl,
    preapprovalId
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

        // HOS-191 Path C: when the return URL carried a `preapproval_id`, link it
        // to the pending local subscription BEFORE polling starts. A 409 (IDOR)
        // is a hard error — stop here, never fall through to polling a
        // subscription this preapproval does not actually belong to. Every other
        // outcome (success, or a non-fatal error like 422) proceeds to the normal
        // poll: the webhook fallback (F3) may complete an ambiguous link shortly
        // after, and the poll will pick that up once `mp_subscription_id` is set.
        const start = async (): Promise<void> => {
            if (preapprovalId) {
                try {
                    const linkResult = await billingApi.linkPreapproval({
                        preapprovalId,
                        localSubscriptionId: localId
                    });
                    if (cancelled) {
                        return;
                    }
                    if (
                        !linkResult.ok &&
                        linkResult.error.status === LINK_PREAPPROVAL_IDOR_STATUS
                    ) {
                        clearPendingCheckoutSubId();
                        setState('linkError');
                        return;
                    }
                } catch {
                    // Network/transient error calling link-preapproval — non-fatal,
                    // fall through to the normal poll (same treatment as a 422).
                }
            }
            if (cancelled) {
                return;
            }
            // First attempt fires immediately; the subscription is often already
            // active by the time MP redirects back.
            void poll();
        };

        void start();

        return () => {
            cancelled = true;
            if (timer) {
                clearTimeout(timer);
            }
        };
        // `preapprovalId` comes from the SSR-rendered query string via props and
        // is stable for the page's lifetime — included for exhaustive-deps
        // correctness, not because it is expected to change post-mount.
    }, [preapprovalId]);

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
        if (state === 'linkError') {
            return {
                title: t('billing.checkout.success.linkErrorTitle', 'No pudimos vincular tu pago'),
                body: t(
                    'billing.checkout.success.linkErrorSubtitle',
                    'Hubo un problema al vincular este pago con tu cuenta. Si ya realizaste el pago, contactá a soporte con el número de operación de MercadoPago.'
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
                              : state === 'linkError'
                                ? styles.iconError
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
                            ) : state === 'linkError' ? (
                                <path
                                    d="M22 22l20 20M42 22L22 42"
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
