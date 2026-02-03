/**
 * InvoicePaymentDialog Component
 *
 * Dialog component for paying unpaid invoices with saved payment methods
 *
 * @module components/billing/InvoicePaymentDialog
 */

'use client';

import type { PaymentMethod } from '@/lib/billing-api-client';
import { getPaymentMethods } from '@/lib/billing-api-client';
import { useEffect, useState } from 'react';

/**
 * Props for the InvoicePaymentDialog component
 */
export interface InvoicePaymentDialogProps {
    /**
     * Whether the dialog is open
     */
    isOpen: boolean;

    /**
     * Callback when dialog should close
     */
    onClose: () => void;

    /**
     * Invoice ID to pay
     */
    invoiceId: string;

    /**
     * Invoice amount to pay
     */
    amount: number;

    /**
     * Currency code
     * @default 'ARS'
     */
    currency?: string;
}

/**
 * API base URL from environment
 */
const API_BASE = import.meta.env.PUBLIC_API_URL || '/api/v1';

/**
 * Format currency in ARS locale
 */
function formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: currency
    }).format(amount);
}

/**
 * InvoicePaymentDialog Component
 *
 * Displays dialog for paying invoices with saved payment methods.
 * Fetches payment methods, allows selection, and processes payment.
 *
 * Features:
 * - Fetches and displays saved payment methods
 * - Pre-selects default payment method
 * - Processes payment through API
 * - Loading states during fetch and payment
 * - Error handling with Spanish messages
 * - Empty state when no payment methods available
 *
 * @param props - Component props
 * @returns React element displaying payment dialog
 *
 * @example
 * ```tsx
 * <InvoicePaymentDialog
 *   isOpen={true}
 *   onClose={() => setOpen(false)}
 *   invoiceId="inv_123"
 *   amount={10000}
 *   currency="ARS"
 * />
 * ```
 */
export function InvoicePaymentDialog({
    isOpen,
    onClose,
    invoiceId,
    amount,
    currency = 'ARS'
}: InvoicePaymentDialogProps) {
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
    const [isLoadingMethods, setIsLoadingMethods] = useState(true);
    const [isPaymentLoading, setIsPaymentLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch payment methods when dialog opens
    useEffect(() => {
        if (!isOpen) return;

        const fetchMethods = async () => {
            try {
                setIsLoadingMethods(true);
                setError(null);

                const methods = await getPaymentMethods();
                setPaymentMethods(methods);

                // Pre-select default method
                const defaultMethod = methods.find((m) => m.isDefault);
                if (defaultMethod) {
                    setSelectedMethodId(defaultMethod.id);
                } else if (methods.length > 0 && methods[0]) {
                    setSelectedMethodId(methods[0].id);
                }
            } catch (err) {
                console.error('Error fetching payment methods:', err);
                setError(
                    err instanceof Error ? err.message : 'Error al cargar los métodos de pago'
                );
            } finally {
                setIsLoadingMethods(false);
            }
        };

        fetchMethods();
    }, [isOpen]);

    // Handle payment submission
    const handlePayment = async () => {
        if (!selectedMethodId) return;

        try {
            setIsPaymentLoading(true);
            setError(null);

            const response = await fetch(`${API_BASE}/billing/invoices/${invoiceId}/pay`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    paymentMethodId: selectedMethodId
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Error al procesar el pago');
            }

            // Success - close dialog
            onClose();
        } catch (err) {
            console.error('Payment error:', err);
            setError(err instanceof Error ? err.message : 'Error al procesar el pago');
        } finally {
            setIsPaymentLoading(false);
        }
    };

    // Don't render if not open
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            // biome-ignore lint/a11y/useSemanticElements: custom dialog overlay with backdrop management
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-dialog-title"
        >
            <div className="relative mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
                {/* Header */}
                <div className="mb-6 flex items-start justify-between">
                    <h2
                        id="payment-dialog-title"
                        className="font-bold text-gray-900 text-xl"
                    >
                        Pagar factura
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Cerrar"
                    >
                        <svg
                            className="h-6 w-6"
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

                {/* Loading state */}
                {isLoadingMethods && (
                    <div
                        className="flex items-center justify-center py-12"
                        // biome-ignore lint/a11y/useSemanticElements: loading indicator pattern used in tests
                        role="status"
                        aria-live="polite"
                        aria-busy="true"
                    >
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
                    </div>
                )}

                {/* Empty state */}
                {!isLoadingMethods && paymentMethods.length === 0 && (
                    <div className="py-8 text-center">
                        <svg
                            className="mx-auto mb-4 h-12 w-12 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                            />
                        </svg>
                        <p className="mb-2 font-medium text-gray-900">
                            No tenés métodos de pago guardados
                        </p>
                        <p className="text-gray-600 text-sm">
                            Agregá un método de pago para continuar
                        </p>
                    </div>
                )}

                {/* Payment methods list */}
                {!isLoadingMethods && paymentMethods.length > 0 && (
                    <div className="space-y-4">
                        {/* Amount display */}
                        <div className="rounded-lg bg-blue-50 p-4">
                            <p className="mb-1 text-gray-600 text-sm">Monto a pagar</p>
                            <p className="font-bold text-2xl text-gray-900">
                                {formatCurrency(amount, currency)}
                            </p>
                        </div>

                        {/* Payment methods */}
                        <div className="space-y-3">
                            <p className="block font-medium text-gray-700 text-sm">
                                Método de pago
                            </p>

                            {paymentMethods.map((method) => (
                                <label
                                    key={method.id}
                                    className="flex cursor-pointer items-center gap-4 rounded-lg border-2 border-gray-200 p-4 transition-colors hover:border-blue-300"
                                    style={{
                                        borderColor:
                                            selectedMethodId === method.id ? '#3B82F6' : undefined
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name="payment-method"
                                        value={method.id}
                                        checked={selectedMethodId === method.id}
                                        onChange={() => setSelectedMethodId(method.id)}
                                        className="h-4 w-4 text-blue-600"
                                    />

                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900">
                                                {method.brand || method.type}
                                            </span>
                                            {method.last4 && (
                                                <span className="text-gray-600">
                                                    •••• {method.last4}
                                                </span>
                                            )}
                                            {method.isDefault && (
                                                <span className="rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-700 text-xs">
                                                    Predeterminado
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card icon */}
                                    <svg
                                        className="h-6 w-6 text-gray-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                                        />
                                    </svg>
                                </label>
                            ))}
                        </div>

                        {/* Error message */}
                        {error && (
                            <div className="rounded-lg bg-red-50 p-4 text-red-800 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
                                disabled={isPaymentLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handlePayment}
                                disabled={!selectedMethodId || isPaymentLoading}
                                className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isPaymentLoading
                                    ? 'Procesando...'
                                    : `Pagar ${formatCurrency(amount, currency)}`}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
