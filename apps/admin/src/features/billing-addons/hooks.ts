import { fetchApi } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    CreateAddonPayload,
    PurchasedAddonFilters,
    PurchasedAddonsResponse,
    UpdateAddonPayload
} from './types';

/**
 * Query keys for addon-related queries
 */
export const addonQueryKeys = {
    addons: {
        all: ['billing-addons'] as const,
        lists: () => [...addonQueryKeys.addons.all, 'list'] as const,
        list: (filters: Record<string, unknown>) =>
            [...addonQueryKeys.addons.lists(), filters] as const,
        details: () => [...addonQueryKeys.addons.all, 'detail'] as const,
        detail: (id: string) => [...addonQueryKeys.addons.details(), id] as const
    },
    purchased: {
        all: ['billing-purchased-addons'] as const,
        lists: () => [...addonQueryKeys.purchased.all, 'list'] as const,
        list: (filters: Record<string, unknown>) =>
            [...addonQueryKeys.purchased.lists(), filters] as const
    }
};

/**
 * Fetch add-ons with filters
 */
async function fetchAddons(filters: Record<string, unknown> = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            params.append(key, String(value));
        }
    }

    const result = await fetchApi<{
        success: boolean;
        data: Record<string, unknown>[];
        metadata?: Record<string, unknown>;
    }>({
        path: `/api/v1/protected/billing/addons?${params.toString()}`
    });
    // Custom billing route returns { success, data: [] } without pagination
    const items = result.data.data;
    return { items, pagination: { total: Array.isArray(items) ? items.length : 0 } };
}

/**
 * Fetch purchased add-ons (customer add-ons)
 */
async function fetchPurchasedAddons(
    filters: PurchasedAddonFilters = {}
): Promise<PurchasedAddonsResponse> {
    const params = new URLSearchParams();

    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.addonSlug) params.append('addonSlug', filters.addonSlug);
    if (filters.customerEmail) params.append('customerEmail', filters.customerEmail);

    const result = await fetchApi<{ success: boolean; data: PurchasedAddonsResponse }>({
        path: `/api/v1/admin/billing/customer-addons?${params.toString()}`
    });
    return result.data.data;
}

/**
 * Create a new add-on
 */
async function createAddon(payload: CreateAddonPayload) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: '/api/v1/protected/billing/addons',
        method: 'POST',
        body: payload
    });
    return result.data.data;
}

/**
 * Update an existing add-on
 */
async function updateAddon({ id, ...payload }: UpdateAddonPayload) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/protected/billing/addons/${id}`,
        method: 'PUT',
        body: payload
    });
    return result.data.data;
}

/**
 * Toggle add-on active status
 */
async function toggleAddonActive(id: string, isActive: boolean) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/protected/billing/addons/${id}`,
        method: 'PATCH',
        body: { isActive }
    });
    return result.data.data;
}

/**
 * Delete an add-on
 */
async function deleteAddon(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/protected/billing/addons/${id}`,
        method: 'DELETE'
    });
    return result.data.data;
}

/**
 * Force expire a purchased add-on
 */
async function forceExpirePurchasedAddon(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/customer-addons/${id}/expire`,
        method: 'POST'
    });
    return result.data.data;
}

/**
 * Force activate a purchased add-on
 */
async function forceActivatePurchasedAddon(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/customer-addons/${id}/activate`,
        method: 'POST'
    });
    return result.data.data;
}

/**
 * Hook to fetch add-ons
 */
export const useAddonsQuery = (filters: Record<string, unknown> = {}) => {
    return useQuery({
        queryKey: addonQueryKeys.addons.list(filters),
        queryFn: () => fetchAddons(filters),
        staleTime: 60_000,
        retry: 1
    });
};

/**
 * Hook to fetch purchased add-ons (customer add-ons)
 */
export const usePurchasedAddonsQuery = (filters: PurchasedAddonFilters = {}) => {
    return useQuery({
        queryKey: addonQueryKeys.purchased.list(filters as Record<string, unknown>),
        queryFn: () => fetchPurchasedAddons(filters),
        staleTime: 60_000,
        retry: 1
    });
};

/**
 * Hook to create a new add-on
 */
export const useCreateAddonMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: CreateAddonPayload) => createAddon(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: addonQueryKeys.addons.lists() });
        }
    });
};

/**
 * Hook to update an add-on
 */
export const useUpdateAddonMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: UpdateAddonPayload) => updateAddon(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: addonQueryKeys.addons.lists() });
        }
    });
};

/**
 * Hook to toggle add-on active status
 */
export const useToggleAddonActiveMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            toggleAddonActive(id, isActive),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: addonQueryKeys.addons.lists() });
        }
    });
};

/**
 * Hook to delete an add-on
 */
export const useDeleteAddonMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteAddon(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: addonQueryKeys.addons.lists() });
        }
    });
};

/**
 * Hook to force-expire a purchased add-on
 */
export const useForceExpirePurchasedAddonMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => forceExpirePurchasedAddon(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: addonQueryKeys.purchased.lists() });
        }
    });
};

/**
 * Hook to force-activate a purchased add-on
 */
export const useForceActivatePurchasedAddonMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => forceActivatePurchasedAddon(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: addonQueryKeys.purchased.lists() });
        }
    });
};
