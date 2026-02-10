/**
 * Custom hook for fetching payment methods
 * Provides a reusable interface for accessing user's payment methods
 *
 * @module hooks/usePaymentMethods
 */

import {
    type PaymentMethod,
    getPaymentMethods,
    updateDefaultPaymentMethod
} from '@/lib/billing-api-client';
import { useQZPay } from '@qazuor/qzpay-react';
import { useEffect, useState } from 'react';

/**
 * Hook return type
 */
export interface UsePaymentMethodsReturn {
    /**
     * List of payment methods
     * Null during initial load
     */
    data: PaymentMethod[] | null;

    /**
     * Loading state indicator
     */
    isLoading: boolean;

    /**
     * Error object if fetch failed
     */
    error: Error | null;

    /**
     * Function to manually refetch payment methods
     */
    refetch: () => Promise<void>;

    /**
     * Function to set a payment method as default
     *
     * @param paymentMethodId - ID of the payment method to set as default
     */
    setDefault: (paymentMethodId: string) => Promise<void>;

    /**
     * Loading state for set default operation
     */
    isSettingDefault: boolean;
}

/**
 * Custom hook for fetching and managing payment methods
 *
 * Uses the QZPay billing instance from context if available,
 * otherwise falls back to direct fetch via billing-api-client.
 *
 * @returns Hook state and actions
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { data, isLoading, error, refetch, setDefault, isSettingDefault } = usePaymentMethods();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   const handleSetDefault = async (methodId: string) => {
 *     try {
 *       await setDefault(methodId);
 *     } catch (err) {
 *       console.error('Failed to set default:', err);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {data?.map(method => (
 *         <PaymentMethodCard
 *           key={method.id}
 *           method={method}
 *           onSetDefault={handleSetDefault}
 *           isUpdating={isSettingDefault}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePaymentMethods(): UsePaymentMethodsReturn {
    const [data, setData] = useState<PaymentMethod[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [isSettingDefault, setIsSettingDefault] = useState(false);

    // Try to get QZPay billing instance from context (for future use)
    const _billing = useQZPay();

    /**
     * Fetch payment methods from API
     */
    const fetchPaymentMethods = async (): Promise<void> => {
        setIsLoading(true);
        setError(null);

        try {
            const methods = await getPaymentMethods();
            setData(methods);
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : 'Failed to fetch payment methods';
            setError(new Error(errorMessage));
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Refetch function for manual triggers
     */
    const refetch = async (): Promise<void> => {
        await fetchPaymentMethods();
    };

    /**
     * Set a payment method as default
     *
     * @param paymentMethodId - ID of the payment method to set as default
     * @throws Error if update fails
     */
    const setDefault = async (paymentMethodId: string): Promise<void> => {
        setIsSettingDefault(true);
        setError(null);

        try {
            await updateDefaultPaymentMethod(paymentMethodId);

            // Refetch to get updated state
            await fetchPaymentMethods();
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : 'Failed to update default payment method';
            const error = new Error(errorMessage);
            setError(error);
            throw error; // Re-throw so caller can handle it
        } finally {
            setIsSettingDefault(false);
        }
    };

    // Fetch on mount
    // biome-ignore lint/correctness/useExhaustiveDependencies: fetchPaymentMethods is stable and should only run on mount
    useEffect(() => {
        void fetchPaymentMethods();
    }, []);

    return {
        data,
        isLoading,
        error,
        refetch,
        setDefault,
        isSettingDefault
    };
}
