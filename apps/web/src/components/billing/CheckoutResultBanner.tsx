/**
 * Checkout Result Banner Component
 *
 * Displays success/cancelled banners after checkout flow completion.
 * Reads the `checkout` query parameter and shows appropriate message:
 * - `checkout=success` → Green success banner
 * - `checkout=cancelled` → Yellow dismissible banner
 * - No param → Renders nothing
 *
 * Features:
 * - Auto-dismisses after 10 seconds
 * - Manual dismiss with X button
 * - Cleans URL after displaying (removes checkout param)
 * - Animated entrance/exit
 * - Accessible (role="alert" for success, role="status" for cancelled)
 *
 * @module components/billing/CheckoutResultBanner
 */

'use client';

import { useEffect, useState } from 'react';

/**
 * Props for CheckoutResultBanner component
 */
export interface CheckoutResultBannerProps {
    /**
     * Override for testing - which result to show
     * If not provided, reads from URL query params
     */
    result?: 'success' | 'cancelled' | null;
}

/**
 * CheckoutResultBanner Component
 *
 * Shows success or cancelled banner after checkout completion.
 * Auto-dismisses after 10 seconds and cleans URL.
 *
 * @example
 * ```tsx
 * import { CheckoutResultBanner } from '@/components/billing';
 *
 * // In Astro page
 * <CheckoutResultBanner client:load />
 * ```
 *
 * @param props - Component props
 * @returns JSX element representing the banner, or null if no result
 */
export function CheckoutResultBanner({ result: propResult }: CheckoutResultBannerProps) {
    const [result, setResult] = useState<'success' | 'cancelled' | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Use prop override if provided (for testing), otherwise read from URL
        if (propResult !== undefined) {
            setResult(propResult);
            if (propResult !== null) {
                setIsVisible(true);
            }
            return;
        }

        // Read from URL query params
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        const checkoutParam = params.get('checkout');

        if (checkoutParam === 'success' || checkoutParam === 'cancelled') {
            setResult(checkoutParam);
            setIsVisible(true);

            // Clean URL (remove checkout param)
            params.delete('checkout');
            const newUrl = params.toString()
                ? `${window.location.pathname}?${params.toString()}`
                : window.location.pathname;

            window.history.replaceState({}, '', newUrl);
        }
    }, [propResult]);

    useEffect(() => {
        // Auto-dismiss after 10 seconds
        if (!isVisible || !result) return;

        const timer = setTimeout(() => {
            setIsVisible(false);
        }, 10000);

        return () => clearTimeout(timer);
    }, [isVisible, result]);

    const handleDismiss = () => {
        setIsVisible(false);
    };

    // Don't render if no result or not visible
    if (!result || !isVisible) {
        return null;
    }

    // Success banner
    if (result === 'success') {
        return (
            <div
                role="alert"
                className="fade-in slide-in-from-top-2 mb-6 flex animate-in items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 transition-all duration-300 ease-in-out"
            >
                <div
                    className="h-6 w-6 flex-shrink-0 text-green-600"
                    aria-hidden="true"
                >
                    <svg
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        className="h-full w-full"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                </div>
                <div className="flex-1">
                    <h3 className="mb-1 font-semibold text-green-800">¡Gracias por tu compra!</h3>
                    <p className="text-green-700 text-sm">Tu suscripción está activa.</p>
                </div>
                <button
                    type="button"
                    onClick={handleDismiss}
                    className="flex-shrink-0 text-green-600 transition-colors hover:text-green-800"
                    aria-label="Cerrar mensaje"
                >
                    <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>
        );
    }

    // Cancelled banner
    if (result === 'cancelled') {
        return (
            <output className="fade-in slide-in-from-top-2 mb-6 flex animate-in items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 transition-all duration-300 ease-in-out">
                <div
                    className="h-6 w-6 flex-shrink-0 text-yellow-600"
                    aria-hidden="true"
                >
                    <svg
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        className="h-full w-full"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                </div>
                <div className="flex-1">
                    <h3 className="mb-1 font-semibold text-yellow-800">Tu compra fue cancelada</h3>
                    <p className="text-sm text-yellow-700">
                        Podés intentar nuevamente cuando quieras.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleDismiss}
                    className="flex-shrink-0 text-yellow-600 transition-colors hover:text-yellow-800"
                    aria-label="Cerrar mensaje"
                >
                    <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </output>
        );
    }

    return null;
}
