/**
 * CancelSubscriptionDialog Component
 *
 * Confirmation dialog for subscription cancellation. Warns users about losing
 * features at period end and allows them to confirm or abort the cancellation.
 *
 * @module components/billing/CancelSubscriptionDialog
 */

'use client';

import { useSubscription } from '@qazuor/qzpay-react';
import { type ReactElement, useState } from 'react';

/**
 * Props for CancelSubscriptionDialog component
 */
export interface CancelSubscriptionDialogProps {
    /**
     * Whether the dialog is open
     */
    isOpen: boolean;

    /**
     * Callback to close the dialog
     */
    onClose: () => void;

    /**
     * Customer ID for the subscription
     */
    customerId: string;

    /**
     * Subscription ID to cancel
     */
    subscriptionId: string;

    /**
     * Plan name to display in warning message
     */
    planName?: string;

    /**
     * Callback after successful cancellation
     */
    onSuccess?: () => void;
}

/**
 * CancelSubscriptionDialog Component
 *
 * Displays a modal dialog to confirm subscription cancellation.
 * Uses the cancel mutation from useSubscription hook to perform the action.
 *
 * @param props - Component props
 * @returns React element with cancel confirmation dialog
 *
 * @example
 * ```tsx
 * import { CancelSubscriptionDialog } from '@/components/billing';
 *
 * function MyComponent() {
 *   const [isOpen, setIsOpen] = useState(false);
 *
 *   return (
 *     <>
 *       <button onClick={() => setIsOpen(true)}>Cancel Subscription</button>
 *       <CancelSubscriptionDialog
 *         isOpen={isOpen}
 *         onClose={() => setIsOpen(false)}
 *         customerId="cus_123"
 *         planName="Pro Plan"
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function CancelSubscriptionDialog({
    isOpen,
    onClose,
    customerId,
    subscriptionId,
    planName,
    onSuccess
}: CancelSubscriptionDialogProps): ReactElement | null {
    const [isCancelling, setIsCancelling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);

    const { cancel } = useSubscription({ customerId });

    // Don't render if not open
    if (!isOpen) {
        return null;
    }

    /**
     * Handle cancel confirmation
     */
    const handleConfirm = async () => {
        setIsCancelling(true);
        setError(null);

        try {
            await cancel(subscriptionId, { cancelAtPeriodEnd: true });
            setShowSuccess(true);

            // Show success message for 2 seconds before closing
            setTimeout(() => {
                setShowSuccess(false);
                onSuccess?.();
                onClose();
            }, 2000);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'No pudimos cancelar tu suscripción. Por favor, intentá nuevamente.'
            );
        } finally {
            setIsCancelling(false);
        }
    };

    /**
     * Handle retry after error
     */
    const handleRetry = () => {
        setError(null);
        void handleConfirm();
    };

    /**
     * Handle dialog close
     */
    const handleClose = () => {
        if (!isCancelling) {
            setError(null);
            setShowSuccess(false);
            onClose();
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 animate-fade-in bg-black/50"
                onClick={handleClose}
                onKeyDown={handleClose}
                aria-hidden="true"
            />

            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                // biome-ignore lint/a11y/useSemanticElements: custom dialog overlay with backdrop management
                role="dialog"
                aria-modal="true"
                aria-labelledby="cancel-dialog-title"
            >
                <div className="w-full max-w-md animate-scale-in rounded-xl bg-white p-6 shadow-2xl">
                    {/* Success State */}
                    {showSuccess ? (
                        <div className="py-4 text-center">
                            {/* Success icon */}
                            <svg
                                className="mx-auto mb-4 h-16 w-16 text-green-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                            >
                                <title>Éxito</title>
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>

                            <h3 className="mb-2 font-semibold text-gray-900 text-xl">
                                Suscripción cancelada
                            </h3>
                            <p className="text-gray-600">
                                Tu suscripción se cancelará al final del período actual
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Warning icon */}
                            <div className="mb-4 flex justify-center">
                                <svg
                                    className="h-12 w-12 text-yellow-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden="true"
                                >
                                    <title>Advertencia</title>
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                </svg>
                            </div>

                            {/* Title */}
                            <h2
                                id="cancel-dialog-title"
                                className="mb-4 text-center font-bold text-2xl text-gray-900"
                            >
                                ¿Cancelar suscripción?
                            </h2>

                            {/* Warning message */}
                            <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                                <p className="mb-2 text-gray-700">
                                    Si cancelás tu{' '}
                                    {planName ? (
                                        <span className="font-semibold">{planName}</span>
                                    ) : (
                                        'suscripción'
                                    )}
                                    :
                                </p>
                                <ul className="list-inside list-disc space-y-1 text-gray-600 text-sm">
                                    <li>Perderás acceso a todas las funciones premium</li>
                                    <li>Tus publicaciones se despublicarán automáticamente</li>
                                    <li>Los datos se conservarán si reactivás tu plan</li>
                                    <li>El cambio será efectivo al final del período actual</li>
                                </ul>
                            </div>

                            {/* Error message */}
                            {error && (
                                <div
                                    className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4"
                                    role="alert"
                                >
                                    <div className="flex items-start gap-2">
                                        <svg
                                            className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            xmlns="http://www.w3.org/2000/svg"
                                            aria-hidden="true"
                                        >
                                            <title>Error</title>
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                        </svg>
                                        <div className="flex-1">
                                            <p className="text-red-800 text-sm">{error}</p>
                                            <button
                                                type="button"
                                                onClick={handleRetry}
                                                className="mt-2 font-medium text-red-600 text-sm underline hover:text-red-700"
                                            >
                                                Reintentar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={isCancelling}
                                    className="flex-1 rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Volver
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={isCancelling}
                                    className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isCancelling ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg
                                                className="h-4 w-4 animate-spin"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                aria-hidden="true"
                                            >
                                                <title>Cargando</title>
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                />
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                />
                                            </svg>
                                            Cancelando...
                                        </span>
                                    ) : (
                                        'Confirmar cancelación'
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
