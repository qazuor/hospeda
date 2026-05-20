/**
 * @file PlanPurchaseButton.client.tsx
 * @description React island button that initiates MercadoPago checkout for subscription plans.
 *
 * On click, reads the Better Auth session via `useSession`. If the user is
 * unauthenticated, redirects to the sign-in page with a return redirect. If
 * authenticated, calls `billingApi.createCheckout` (the Hospeda-custom
 * `start-paid` route) and follows the returned `checkoutUrl` to the
 * MercadoPago payment page.
 *
 * Hydration: client:load — checkout CTAs are interactive immediately.
 */

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { billingApi, userApi } from '../../lib/api/endpoints-protected';
import { useSession } from '../../lib/auth-client';
import type { SupportedLocale } from '../../lib/i18n';
import { createTranslations } from '../../lib/i18n';
import { buildUrl } from '../../lib/urls';
import styles from './PlanPurchaseButton.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the PlanPurchaseButton component.
 */
export interface PlanPurchaseButtonProps {
    /** Billing plan slug sent to the checkout endpoint. */
    readonly planSlug: string;
    /** Numeric plan price used for display next to the CTA text. */
    readonly price: number;
    /** Currency code shown with the price. */
    readonly currency: 'ARS' | 'USD';
    /** Button label text (e.g. "Contratar" or "Get started"). */
    readonly ctaText: string;
    /** Current locale for translations and URL construction. */
    readonly locale: SupportedLocale;
}

// ---------------------------------------------------------------------------
// Subscription cache (module singleton)
// ---------------------------------------------------------------------------

/**
 * Module-level promise that fetches the current user's subscription. Several
 * <PlanPurchaseButton> islands hydrate on the same pricing page; without
 * sharing the request each one would issue its own GET, hitting the API N
 * times for a value that's identical across all buttons. The first call
 * starts the fetch; all subsequent calls await the same promise.
 *
 * Reset by `clearSubscriptionCache()` if the page wants to invalidate after
 * a checkout completes (currently not used — the success page is a separate
 * route so the cache is naturally fresh on next visit).
 */
let subscriptionPromise: Promise<string | null> | null = null;

function fetchCurrentPlanSlug(): Promise<string | null> {
    if (subscriptionPromise) return subscriptionPromise;
    subscriptionPromise = userApi
        .getSubscription()
        .then((result) => {
            if (!result.ok) return null;
            return result.data.subscription?.planSlug ?? null;
        })
        .catch(() => null);
    return subscriptionPromise;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a price amount for display, using a simple currency prefix.
 * Avoids complex i18n number formatting for MVP; suitable for static pricing pages.
 *
 * @param params.amount - Numeric price value
 * @param params.currency - ISO currency code
 * @returns Formatted price string, e.g. "$ 1.200" or "USD 12"
 */
function formatPrice({
    amount,
    currency
}: {
    readonly amount: number;
    readonly currency: 'ARS' | 'USD';
}): string {
    const prefix = currency === 'ARS' ? '$' : 'USD';
    return `${prefix} ${amount.toLocaleString('es-AR')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PlanPurchaseButton — interactive CTA island for initiating plan checkout.
 *
 * Behaviour:
 * - **Unauthenticated**: navigates to `/auth/signin?redirect=/suscriptores/planes`
 * - **Authenticated (idle)**: displays `ctaText` + formatted `price`
 * - **Authenticated (loading)**: disables button, shows processing spinner + text
 * - **Authenticated (error)**: re-enables button, renders inline error below
 *
 * The button is disabled while a checkout request is in flight to prevent
 * double-submission. The `aria-label` is updated to the processing label
 * during loading so assistive technology announces the state change.
 *
 * @example
 * ```astro
 * <PlanPurchaseButton
 *   client:load
 *   planSlug="owner-pro"
 *   price={1200}
 *   currency="ARS"
 *   ctaText="Contratar"
 *   locale={locale}
 * />
 * ```
 */
export function PlanPurchaseButton({
    planSlug,
    price,
    currency,
    ctaText,
    locale
}: PlanPurchaseButtonProps): JSX.Element {
    const { data: session, isPending: sessionPending } = useSession();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPlanSlug, setCurrentPlanSlug] = useState<string | null>(null);

    const { t } = createTranslations(locale);

    const isAuthenticated = !sessionPending && Boolean(session?.user);
    const formattedPrice = formatPrice({ amount: price, currency });

    const processingText = t('billing.checkout.button.processing', 'Procesando...');
    const processingAriaLabel = t('billing.checkout.button.processingAriaLabel', 'Procesando pago');
    const errorText = t(
        'billing.checkout.button.error',
        'No pudimos iniciar el pago. Intenta de nuevo.'
    );
    const currentPlanLabel = t('billing.checkout.button.currentPlan', 'Plan actual');
    const currentPlanAriaLabel = t(
        'billing.checkout.button.currentPlanAriaLabel',
        'Este es tu plan actual'
    );

    // Fetch the user's current subscription once they're authenticated. Shared
    // across every PlanPurchaseButton on the page via subscriptionPromise so a
    // pricing grid with N tiers issues exactly one request, not N.
    useEffect(() => {
        if (!isAuthenticated) {
            setCurrentPlanSlug(null);
            return;
        }
        let cancelled = false;
        fetchCurrentPlanSlug().then((slug) => {
            if (!cancelled) setCurrentPlanSlug(slug);
        });
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    const isCurrentPlan = isAuthenticated && currentPlanSlug === planSlug;

    /**
     * Handle button click.
     * Redirects unauthenticated users to sign-in; fires checkout POST for authenticated users.
     */
    async function handleClick(): Promise<void> {
        // Clear any previous error on each attempt.
        setError(null);

        if (!isAuthenticated) {
            const plansPath = buildUrl({ locale, path: 'suscriptores/planes' });
            const signinPath = `${buildUrl({ locale, path: 'auth/signin' })}?redirect=${encodeURIComponent(plansPath)}`;
            window.location.href = signinPath;
            return;
        }

        // Prevent double-submission.
        if (loading) {
            return;
        }

        setLoading(true);

        try {
            // The pricing grid currently only renders monthly prices; annual is
            // gated on a future interval-selector (see ui-audit-2026.md §3).
            const result = await billingApi.createCheckout({
                planSlug,
                billingInterval: 'monthly'
            });

            if (!result.ok || !result.data.checkoutUrl) {
                setError(errorText);
                return;
            }

            window.location.href = result.data.checkoutUrl;
        } catch {
            setError(errorText);
        } finally {
            setLoading(false);
        }
    }

    const buttonAriaLabel = isCurrentPlan
        ? currentPlanAriaLabel
        : loading
          ? processingAriaLabel
          : `${ctaText} — ${formattedPrice}`;

    return (
        <div className={styles.wrapper}>
            <button
                type="button"
                disabled={loading || isCurrentPlan}
                aria-label={buttonAriaLabel}
                aria-busy={loading}
                aria-disabled={isCurrentPlan}
                onClick={isCurrentPlan ? undefined : () => void handleClick()}
                className={`${styles.button}${isCurrentPlan ? ` ${styles.buttonCurrent}` : ''}`}
            >
                {isCurrentPlan ? (
                    <span className={styles.currentContent}>
                        <svg
                            className={styles.currentIcon}
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                        >
                            <path
                                d="M5 12.5l4.5 4.5L19 7"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                        <span>{currentPlanLabel}</span>
                    </span>
                ) : loading ? (
                    <span className={styles.loadingContent}>
                        <span
                            className={styles.spinner}
                            aria-hidden="true"
                        />
                        <span>{processingText}</span>
                    </span>
                ) : (
                    <span className={styles.idleContent}>
                        <span className={styles.ctaText}>{ctaText}</span>
                        <span className={styles.price}>{formattedPrice}</span>
                    </span>
                )}
            </button>

            {error !== null && (
                <p
                    role="alert"
                    className={styles.errorMessage}
                >
                    {error}
                </p>
            )}
        </div>
    );
}
