import { fetchApi } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BillingSettings, UpdateBillingSettingsPayload } from './types';

/**
 * Query keys for billing settings
 */
export const billingSettingsQueryKeys = {
    settings: ['billing-settings'] as const
};

/**
 * Fetch billing settings
 */
async function fetchBillingSettings(): Promise<BillingSettings> {
    const result = await fetchApi<{ success: boolean; data: BillingSettings }>({
        path: '/api/v1/billing/settings'
    });
    return result.data.data;
}

/**
 * Update billing settings
 */
async function updateBillingSettings(
    payload: UpdateBillingSettingsPayload
): Promise<BillingSettings> {
    const result = await fetchApi<{ success: boolean; data: BillingSettings }>({
        path: '/api/v1/billing/settings',
        method: 'PATCH',
        body: payload
    });
    return result.data.data;
}

/**
 * Hook to fetch billing settings
 */
export const useBillingSettingsQuery = () => {
    return useQuery({
        queryKey: billingSettingsQueryKeys.settings,
        queryFn: fetchBillingSettings,
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 1
    });
};

/**
 * Hook to update billing settings
 */
export const useUpdateBillingSettingsMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: UpdateBillingSettingsPayload) => updateBillingSettings(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: billingSettingsQueryKeys.settings });
        }
    });
};
