/**
 * BillingErrorState Component
 *
 * Reusable error state component for billing sections when an error occurs.
 * Displays an error message with an optional retry button.
 *
 * @module components/billing/BillingErrorState
 */

'use client';

import { useTranslations } from '@repo/i18n';
import type { ReactElement } from 'react';

/**
 * Props for the BillingErrorState component
 */
export interface BillingErrorStateProps {
    /**
     * Optional error title
     * @default Uses i18n key 'billing.errorState.defaultTitle'
     */
    title?: string;

    /**
     * Error message to display
     * @example "No se pudo conectar con el servidor"
     */
    message: string;

    /**
     * Optional retry callback function
     * If provided, a retry button will be displayed
     */
    onRetry?: () => void;

    /**
     * Optional retry button label
     * @default Uses i18n key 'billing.errorState.defaultRetry'
     */
    retryLabel?: string;
}

/**
 * Alert icon SVG
 * Inline SVG to avoid external dependencies
 */
function AlertIcon(): ReactElement {
    return (
        <svg
            className="h-12 w-12 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <title>Alert</title>
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
        </svg>
    );
}

/**
 * BillingErrorState Component
 *
 * Renders an error state message for billing sections.
 * Used when an error occurs while loading or processing billing data.
 *
 * Visual design:
 * - Red-themed error display with alert icon
 * - Clear error title and message
 * - Optional retry button
 * - Border and shadow for visual separation
 *
 * Accessibility:
 * - Uses role="alert" for immediate screen reader announcement
 * - Clear error messaging
 * - Keyboard accessible retry button
 * - Proper color contrast
 *
 * @param props - Component props
 * @returns React element displaying error state UI
 *
 * @example
 * ```tsx
 * import { BillingErrorState } from '@/components/billing';
 *
 * <BillingErrorState
 *   title="Error al cargar facturas"
 *   message="No se pudo conectar con el servidor. Por favor, intenta nuevamente."
 *   onRetry={() => refetch()}
 * />
 * ```
 */
export function BillingErrorState({
    title: titleProp,
    message,
    onRetry,
    retryLabel: retryLabelProp
}: BillingErrorStateProps): ReactElement {
    const { t } = useTranslations();

    const title = titleProp ?? t('billing.errorState.defaultTitle');
    const retryLabel = retryLabelProp ?? t('billing.errorState.defaultRetry');

    return (
        <div
            className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm"
            role="alert"
            aria-live="assertive"
        >
            {/* Icon and title */}
            <div className="mb-4 flex items-start gap-4">
                <AlertIcon />
                <div className="flex-1">
                    <h3 className="font-bold text-red-900 text-xl">{title}</h3>
                </div>
            </div>

            {/* Error message */}
            <p className="mb-6 pl-16 text-red-800">{message}</p>

            {/* Optional retry button */}
            {onRetry && (
                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 font-medium text-white transition-colors duration-200 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        aria-label={retryLabel}
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                        {retryLabel}
                    </button>
                </div>
            )}
        </div>
    );
}
