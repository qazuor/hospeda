/**
 * @file PlanPurchaseButton.client.tsx
 * @description React island button that initiates MercadoPago checkout for subscription plans.
 *
 * On click, reads the Better Auth session via `useSession`. If the user is
 * unauthenticated, redirects to the sign-in page with a return redirect. If
 * authenticated, POSTs to the protected billing checkout endpoint and follows
 * the returned `checkoutUrl` to the MercadoPago payment page.
 *
 * Hydration: client:load — checkout CTAs are interactive immediately.
 */

import type { JSX } from 'react';
import { useState } from 'react';
import { useSession } from '../../lib/auth-client';
import type { SupportedLocale } from '../../lib/i18n';
import { createTranslations } from '../../lib/i18n';
import { buildUrl } from '../../lib/urls';
import styles from './PlanPurchaseButton.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Shape returned by `POST /api/v1/protected/billing/checkout`.
 * The outer API envelope (`{ success, data }`) is unwrapped by `apiClient`.
 */
interface CheckoutResponse {
    readonly checkoutUrl: string;
    readonly orderId: string;
    readonly amount: number;
    readonly currency: string;
    readonly expiresAt: string | null;
}

/**
 * Props for the PlanPurchaseButton component.
 */
export interface PlanPurchaseButtonProps {
    /** Billing plan identifier sent to the checkout endpoint. */
    readonly planId: string;
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
 *   planId="plan_starter"
 *   price={1200}
 *   currency="ARS"
 *   ctaText="Contratar"
 *   locale={locale}
 * />
 * ```
 */
export function PlanPurchaseButton({
    planId,
    price,
    currency,
    ctaText,
    locale
}: PlanPurchaseButtonProps): JSX.Element {
    const { data: session, isPending: sessionPending } = useSession();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { t } = createTranslations(locale);

    const isAuthenticated = !sessionPending && Boolean(session?.user);
    const formattedPrice = formatPrice({ amount: price, currency });

    const processingText = t('billing.checkout.button.processing', 'Procesando...');
    const processingAriaLabel = t('billing.checkout.button.processingAriaLabel', 'Procesando pago');
    const errorText = t(
        'billing.checkout.button.error',
        'No pudimos iniciar el pago. Intenta de nuevo.'
    );

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
            const apiUrl = (import.meta.env.PUBLIC_API_URL as string | undefined) ?? '';
            const url = `${apiUrl.replace(/\/$/, '')}/api/v1/protected/billing/checkout`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ planId })
            });

            const body: unknown = await response.json().catch(() => null);

            if (!response.ok) {
                setError(errorText);
                return;
            }

            // Unwrap the standard API envelope: { success, data: CheckoutResponse }
            const envelope = body as { data?: CheckoutResponse } | null;
            const data = envelope?.data;

            if (!data?.checkoutUrl) {
                setError(errorText);
                return;
            }

            window.location.href = data.checkoutUrl;
        } catch {
            setError(errorText);
        } finally {
            setLoading(false);
        }
    }

    const buttonAriaLabel = loading ? processingAriaLabel : `${ctaText} — ${formattedPrice}`;

    return (
        <div className={styles.wrapper}>
            <button
                type="button"
                disabled={loading}
                aria-label={buttonAriaLabel}
                aria-busy={loading}
                onClick={() => void handleClick()}
                className={styles.button}
            >
                {loading ? (
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
