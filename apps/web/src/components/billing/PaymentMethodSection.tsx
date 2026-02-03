/**
 * PaymentMethodSection Component
 *
 * Displays and manages user's payment methods
 *
 * @module components/billing/PaymentMethodSection
 */

'use client';

import type { PaymentMethod } from '@/lib/billing-api-client';
import { getPaymentMethods, updateDefaultPaymentMethod } from '@/lib/billing-api-client';
import { useEffect, useState } from 'react';
import { BillingEmptyState } from './BillingEmptyState';
import { BillingErrorState } from './BillingErrorState';

/**
 * Props for the PaymentMethodSection component
 */
export interface PaymentMethodSectionProps {
    /**
     * Optional API base URL
     * @default import.meta.env.PUBLIC_API_URL || '/api/v1'
     */
    apiUrl?: string;
}

/**
 * PaymentMethodSection Component
 *
 * Displays user's saved payment methods with ability to set default.
 * Fetches payment methods, displays cards with type/brand/last4,
 * and allows setting default payment method.
 *
 * Features:
 * - Fetches payment methods from API
 * - Displays payment method cards
 * - Default badge on primary method
 * - Set as default action
 * - Loading skeleton states
 * - Empty state when no methods
 * - Error state with retry
 *
 * @param props - Component props
 * @returns React element displaying payment methods section
 *
 * @example
 * ```tsx
 * <PaymentMethodSection apiUrl="/api/v1" />
 * ```
 */
export function PaymentMethodSection({ apiUrl: _apiUrl }: PaymentMethodSectionProps) {
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [updatingMethodId, setUpdatingMethodId] = useState<string | null>(null);

    // Fetch payment methods
    const fetchPaymentMethods = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const methods = await getPaymentMethods();
            setPaymentMethods(methods);
        } catch (err) {
            console.error('Error fetching payment methods:', err);
            setError(err instanceof Error ? err : new Error('Error al cargar los métodos de pago'));
        } finally {
            setIsLoading(false);
        }
    };

    // Initial fetch
    // biome-ignore lint/correctness/useExhaustiveDependencies: fetchPaymentMethods is stable, apiUrl not needed
    useEffect(() => {
        fetchPaymentMethods();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Handle set as default
    const handleSetDefault = async (methodId: string) => {
        try {
            setUpdatingMethodId(methodId);
            setError(null);

            await updateDefaultPaymentMethod(methodId);

            // Refetch to get updated state
            await fetchPaymentMethods();
        } catch (err) {
            console.error('Error setting default payment method:', err);
            setError(
                err instanceof Error ? err : new Error('Error al establecer método predeterminado')
            );
        } finally {
            setUpdatingMethodId(null);
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">Métodos de pago</h2>
                <div
                    className="flex items-center justify-center py-12"
                    // biome-ignore lint/a11y/useSemanticElements: loading indicator pattern used in tests
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                >
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">Métodos de pago</h2>
                <BillingErrorState
                    title="Error al cargar métodos de pago"
                    message={error.message}
                    onRetry={fetchPaymentMethods}
                />
            </div>
        );
    }

    // Empty state
    if (paymentMethods.length === 0) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">Métodos de pago</h2>
                <BillingEmptyState
                    title="No tenés métodos de pago configurados"
                    description="Agregá un método de pago para facilitar tus futuras transacciones. Tus datos estarán seguros y encriptados."
                    icon={
                        <svg
                            className="h-16 w-16 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                            />
                        </svg>
                    }
                />
            </div>
        );
    }

    // Payment methods list
    return (
        <div className="rounded-xl bg-white p-8 shadow-lg">
            <h2 className="mb-6 font-bold text-2xl text-gray-900">Métodos de pago</h2>

            <div className="grid gap-4 md:grid-cols-2">
                {paymentMethods.map((method) => {
                    const isUpdating = updatingMethodId === method.id;

                    return (
                        <div
                            key={method.id}
                            className="rounded-lg border-2 border-gray-200 p-6 transition-shadow hover:shadow-md"
                        >
                            {/* Card header */}
                            <div className="mb-4 flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    {/* Card icon */}
                                    <div className="rounded-lg bg-gray-100 p-2">
                                        <svg
                                            className="h-6 w-6 text-gray-600"
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
                                    </div>

                                    <div>
                                        <p className="font-semibold text-gray-900">
                                            {method.brand || method.type}
                                        </p>
                                        {method.last4 && (
                                            <p className="text-gray-600 text-sm">
                                                •••• {method.last4}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Default badge */}
                                {method.isDefault && (
                                    <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700 text-xs">
                                        Predeterminado
                                    </span>
                                )}
                            </div>

                            {/* Set default button */}
                            {!method.isDefault && (
                                <button
                                    type="button"
                                    onClick={() => handleSetDefault(method.id)}
                                    disabled={isUpdating}
                                    className="mt-2 w-full rounded-lg border border-blue-600 px-4 py-2 font-medium text-blue-600 text-sm transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    aria-label="Establecer como predeterminado"
                                >
                                    {isUpdating
                                        ? 'Actualizando...'
                                        : 'Establecer como predeterminado'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Add payment method CTA */}
            <div className="mt-6 text-center">
                <a
                    href="/mi-cuenta/payment-methods/add"
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
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
                            d="M12 4v16m8-8H4"
                        />
                    </svg>
                    Agregar método de pago
                </a>
            </div>
        </div>
    );
}
