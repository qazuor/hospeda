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
 * This island watches TWO sources until one of them says the subscription is
 * live, on the backoff schedule in `lib/billing/checkout-poll-schedule.ts`
 * (~3 minutes, 22 attempts). On success it swaps to the success state; when the
 * budget runs out it renders an explicit terminal state with two ways out — it
 * never spins forever, and it never gives up without having asked.
 *
 * - ID-SCOPED — `GET /billing/subscriptions/:localId/status`, using the
 *   `localSubscriptionId` that `PlanPurchaseButton` stashed in sessionStorage
 *   before the redirect. Precise, but it depends on a value the browser had to
 *   carry across a third-party redirect.
 * - IDENTITY-SCOPED — `GET /users/me/subscription`, scoped by session instead.
 *
 * H-78 is why the second source exists. In production a buyer returned from
 * MercadoPago, the page found no stashed id, and it went STRAIGHT to the
 * terminal state without issuing a single request — telling someone whose card
 * had just been charged that things were "taking longer than usual", a claim
 * nothing had measured. Meanwhile the backend had finished in 27 seconds and
 * the subscription was live. The stashed id was the page's only source, so its
 * absence (a different tab, storage disabled, a reload after it was cleared,
 * or a link completed server-side by the heuristic linker) meant the page had
 * nothing to ask. Now the absence of the id costs precision, not the answer.
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
import { billingApi, userApi } from '../../lib/api/endpoints-protected';
import {
    clearPendingCheckoutSubId,
    readPendingCheckoutSubId
} from '../../lib/billing/checkout-pending';
import {
    CHECKOUT_POLL_MAX_ATTEMPTS,
    nextPollDelayMs
} from '../../lib/billing/checkout-poll-schedule';
import type { SupportedLocale } from '../../lib/i18n';
import { createTranslations } from '../../lib/i18n';
import styles from './CheckoutStatusPoller.module.css';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Statuses from the ID-SCOPED source (`GET /billing/subscriptions/:id/status`)
 * that mean the checkout succeeded. That endpoint returns the raw
 * `SubscriptionStatusEnum` vocabulary.
 */
const SUCCESS_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing', 'comp']);

/**
 * Statuses from the IDENTITY-SCOPED source (`GET /users/me/subscription`) that
 * mean the checkout succeeded.
 *
 * Deliberately a SEPARATE set. That endpoint remaps QZPay's statuses into a
 * smaller vocabulary of its own before returning them: `trialing` arrives as
 * `'trial'`, and `comp` arrives as `'active'` with a separate `isComplimentary`
 * flag. Reusing `SUCCESS_STATUSES` here would compile, read as correct, and
 * silently never match a card-first trial — which since HOS-171 is the most
 * common paid outcome there is.
 */
const IDENTITY_SUCCESS_STATUSES: ReadonlySet<string> = new Set(['active', 'trial']);

/**
 * HTTP status that `billingApi.linkPreapproval` returns for a hard IDOR error
 * (the preapproval belongs to a different local subscription/user). Every
 * other error status is treated as non-fatal — see the module docstring.
 */
const LINK_PREAPPROVAL_IDOR_STATUS = 409;

type PollerState = 'verifying' | 'success' | 'unresolved' | 'linkError';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CheckoutStatusPollerProps {
    /** Current locale for translated copy. */
    readonly locale: SupportedLocale;
    /** Locale-aware `/mi-cuenta` URL for the success + fallback CTAs. */
    readonly miCuentaUrl: string;
    /**
     * Locale-aware contact URL, offered as a second way out of the terminal
     * `unresolved` state (H-78). A buyer whose payment never resolved needs a
     * human: sending them only to the account page, which will show the same
     * nothing, is not an exit.
     */
    readonly supportUrl: string;
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
 * CheckoutStatusPoller — watches both status sources until the paid
 * subscription activates (or the retry budget runs out), rendering
 * verifying → success / unresolved states in place.
 */
export function CheckoutStatusPoller({
    locale,
    miCuentaUrl,
    supportUrl,
    preapprovalId
}: CheckoutStatusPollerProps): JSX.Element {
    const { t } = createTranslations(locale);
    const [state, setState] = useState<PollerState>('verifying');

    useEffect(() => {
        // May be absent: a different tab, storage disabled, or a reload after a
        // previous run cleared it. That is NOT a reason to stop — see the
        // identity-scoped source below.
        const localId = readPendingCheckoutSubId();

        let cancelled = false;
        let attempts = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;

        /**
         * Ask the id-scoped source. Precise but fragile: it depends on a value
         * the browser had to carry across a third-party redirect.
         */
        const askIdScoped = async (): Promise<boolean> => {
            if (!localId) {
                return false;
            }
            const result = await billingApi.getSubscriptionStatus({ localId });
            return result.ok && SUCCESS_STATUSES.has(result.data.status);
        };

        /**
         * Ask the identity-scoped source. Scoped by session rather than by a
         * carried value, so it answers in exactly the cases where the stashed
         * id does not — including the one H-78 hit in production, where the
         * subscription was linked server-side by the heuristic linker.
         *
         * Domain note: this resolves the ACCOMMODATION subscription (the
         * endpoint's server-side default). A commerce checkout that also lost
         * its stashed id therefore stays unresolved rather than resolving
         * against the wrong domain — the conservative failure, deliberately
         * chosen over a confident wrong answer.
         */
        const askIdentityScoped = async (): Promise<boolean> => {
            const result = await userApi.getSubscription();
            return (
                result.ok &&
                result.data.subscription !== null &&
                IDENTITY_SUCCESS_STATUSES.has(result.data.subscription.status)
            );
        };

        const poll = async (): Promise<void> => {
            if (cancelled) {
                return;
            }
            attempts += 1;

            // Both sources, in parallel, each isolated: a throw from one must
            // never cancel the other, and a transient network error must never
            // end the watch. `allSettled` is what guarantees both.
            const answers = await Promise.allSettled([askIdScoped(), askIdentityScoped()]);

            if (cancelled) {
                return;
            }
            if (answers.some((a) => a.status === 'fulfilled' && a.value)) {
                clearPendingCheckoutSubId();
                setState('success');
                return;
            }

            if (attempts >= CHECKOUT_POLL_MAX_ATTEMPTS) {
                clearPendingCheckoutSubId();
                setState('unresolved');
                return;
            }
            timer = setTimeout(() => void poll(), nextPollDelayMs({ attempt: attempts }));
        };

        // HOS-191 Path C: when the return URL carried a `preapproval_id`, link it
        // to the pending local subscription BEFORE polling starts. A 409 (IDOR)
        // is a hard error — stop here, never fall through to polling a
        // subscription this preapproval does not actually belong to. Every other
        // outcome (success, or a non-fatal error like 422) proceeds to the normal
        // poll: the webhook fallback (F3) may complete an ambiguous link shortly
        // after, and the poll will pick that up once `mp_subscription_id` is set.
        const start = async (): Promise<void> => {
            // Linking needs BOTH ids. Without a stashed local id there is
            // nothing to link the preapproval to, so skip straight to polling —
            // the server-side linker (F3) covers that case.
            if (preapprovalId && localId) {
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
        if (state === 'unresolved') {
            // What this copy may NOT say: "te avisamos por mail". There is no
            // subscription-activation email in the system — `SUBSCRIPTION_PURCHASE`
            // is declared in @repo/notifications but never dispatched by any
            // handler, and a card-first trial charges nothing on day 1, so the
            // generic payment receipt does not fire either. Promising a message
            // that never arrives is worse than the silence it papers over.
            return {
                title: t(
                    'billing.checkout.success.unresolvedTitle',
                    'Seguimos confirmando tu pago'
                ),
                body: t(
                    'billing.checkout.success.unresolvedSubtitle',
                    'Tu pago no se perdió. MercadoPago puede tardar unos minutos en confirmarlo y, en cuanto lo haga, tu plan queda activo automáticamente. Podés cerrar esta página: revisá el estado en Mi Cuenta, o escribinos si en un rato seguís sin verlo.'
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
                            : state === 'unresolved'
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
                        {/* H-78: the terminal state must offer a way to reach a
                            person, not just a link back to a page that will show
                            the same nothing. Only here — a resolved success needs
                            no support link. */}
                        {state === 'unresolved' && (
                            <a
                                href={supportUrl}
                                className={styles.ctaSecondary}
                            >
                                {t('billing.checkout.success.unresolvedSupportCta', 'Escribinos')}
                            </a>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
