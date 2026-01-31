import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    CreateAddonPayload,
    PurchasedAddonFilters,
    PurchasedAddonsResponse,
    UpdateAddonPayload
} from './types';

const API_BASE = '/api/v1';

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
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function fetchAddons(filters: Record<string, unknown> = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            params.append(key, String(value));
        }
    }

    // TODO: Update endpoint when API is ready
    // Expected endpoint: GET /api/v1/billing/addons
    const response = await fetch(`${API_BASE}/billing/addons?${params.toString()}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch add-ons: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
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

    const response = await fetch(`${API_BASE}/billing/customer-addons?${params.toString()}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch purchased add-ons: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Create a new add-on
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function createAddon(payload: CreateAddonPayload) {
    // TODO: Update endpoint when API is ready
    // Expected endpoint: POST /api/v1/billing/addons
    const response = await fetch(`${API_BASE}/billing/addons`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to create add-on: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Update an existing add-on
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function updateAddon({ id, ...payload }: UpdateAddonPayload) {
    // TODO: Update endpoint when API is ready
    // Expected endpoint: PUT /api/v1/billing/addons/:id
    const response = await fetch(`${API_BASE}/billing/addons/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to update add-on: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Toggle add-on active status
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function toggleAddonActive(id: string, isActive: boolean) {
    // TODO: Update endpoint when API is ready
    // Expected endpoint: PATCH /api/v1/billing/addons/:id
    const response = await fetch(`${API_BASE}/billing/addons/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ isActive })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to toggle add-on: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Delete an add-on
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function deleteAddon(id: string) {
    // TODO: Update endpoint when API is ready
    // Expected endpoint: DELETE /api/v1/billing/addons/:id
    const response = await fetch(`${API_BASE}/billing/addons/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to delete add-on: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Force expire a purchased add-on
 */
async function forceExpirePurchasedAddon(id: string) {
    const response = await fetch(`${API_BASE}/billing/customer-addons/${id}/expire`, {
        method: 'POST',
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
            error.message || `Failed to force-expire purchased add-on: ${response.statusText}`
        );
    }

    const json = await response.json();
    return json.data;
}

/**
 * Force activate a purchased add-on
 */
async function forceActivatePurchasedAddon(id: string) {
    const response = await fetch(`${API_BASE}/billing/customer-addons/${id}/activate`, {
        method: 'POST',
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
            error.message || `Failed to force-activate purchased add-on: ${response.statusText}`
        );
    }

    const json = await response.json();
    return json.data;
}

/**
 * Hook to fetch add-ons
 */
export const useAddonsQuery = (filters: Record<string, unknown> = {}) => {
    return useQuery({
        queryKey: addonQueryKeys.addons.list(filters),
        queryFn: () => fetchAddons(filters),
        staleTime: 60_000
    });
};

/**
 * Hook to fetch purchased add-ons (customer add-ons)
 */
export const usePurchasedAddonsQuery = (filters: PurchasedAddonFilters = {}) => {
    return useQuery({
        queryKey: addonQueryKeys.purchased.list(filters as Record<string, unknown>),
        queryFn: () => fetchPurchasedAddons(filters),
        staleTime: 60_000
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
