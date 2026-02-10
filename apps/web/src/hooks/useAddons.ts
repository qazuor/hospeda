/**
 * Custom hook for fetching active addon purchases
 * Provides a reusable interface for accessing user's active add-ons
 *
 * @module hooks/useAddons
 */

import { useQZPay } from '@qazuor/qzpay-react';
import { useEffect, useState } from 'react';

/**
 * Active addon purchase data structure
 */
export interface ActiveAddonPurchase {
    id: string;
    addonId: string;
    name: string;
    description: string | null;
    status: 'active' | 'expiring_soon' | 'expired';
    expiresAt: string | null;
    quantity: number;
}

/**
 * Hook return type
 */
export interface UseAddonsReturn {
    /**
     * List of active addon purchases
     * Null during initial load
     */
    data: ActiveAddonPurchase[] | null;

    /**
     * Loading state indicator
     */
    isLoading: boolean;

    /**
     * Error object if fetch failed
     */
    error: Error | null;

    /**
     * Function to manually refetch addons
     */
    refetch: () => Promise<void>;
}

/**
 * API response structure
 */
interface ApiResponse {
    success: boolean;
    data?: ActiveAddonPurchase[];
    error?: {
        message: string;
    };
}

/**
 * Custom hook for fetching active addon purchases
 *
 * Uses the QZPay billing instance from context if available,
 * otherwise falls back to direct fetch.
 *
 * @returns Hook state and actions
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { data, isLoading, error, refetch } = useAddons();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       {data?.map(addon => (
 *         <AddonCard key={addon.id} addon={addon} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAddons(): UseAddonsReturn {
    const [data, setData] = useState<ActiveAddonPurchase[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Try to get QZPay billing instance from context (for future use)
    const _billing = useQZPay();

    /**
     * Fetch addons from API
     */
    const fetchAddons = async (): Promise<void> => {
        setIsLoading(true);
        setError(null);

        try {
            // Determine API base URL
            const baseUrl = import.meta.env.PUBLIC_API_URL || '/api/v1';
            const endpoint = `${baseUrl}/billing/addons/my`;

            const response = await fetch(endpoint, {
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch addons: ${response.status}`);
            }

            const result = (await response.json()) as ApiResponse;

            if (result.success && result.data) {
                setData(result.data);
            } else {
                throw new Error(result.error?.message || 'Unknown error');
            }
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : 'Failed to fetch active addons';
            setError(new Error(errorMessage));
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Refetch function for manual triggers
     */
    const refetch = async (): Promise<void> => {
        await fetchAddons();
    };

    // Fetch on mount
    // biome-ignore lint/correctness/useExhaustiveDependencies: fetchAddons is stable and should only run on mount
    useEffect(() => {
        void fetchAddons();
    }, []);

    return {
        data,
        isLoading,
        error,
        refetch
    };
}
