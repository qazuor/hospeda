import { fetchApi } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatePromoCodePayload, PromoCodeFilters, UpdatePromoCodePayload } from './types';

/**
 * Query keys for promo code-related queries
 */
export const promoCodeQueryKeys = {
    promoCodes: {
        all: ['promo-codes'] as const,
        lists: () => [...promoCodeQueryKeys.promoCodes.all, 'list'] as const,
        list: (filters: PromoCodeFilters) =>
            [...promoCodeQueryKeys.promoCodes.lists(), filters] as const,
        details: () => [...promoCodeQueryKeys.promoCodes.all, 'detail'] as const,
        detail: (id: string) => [...promoCodeQueryKeys.promoCodes.details(), id] as const
    }
};

/**
 * Map UI filters to API query parameters.
 * UI uses status ("active"/"expired"/"inactive"), type, search.
 * API expects active (bool string), expired (bool string), codeSearch.
 */
function buildPromoCodeParams(filters: PromoCodeFilters): URLSearchParams {
    const params = new URLSearchParams();

    if (filters.page) params.append('page', String(filters.page));
    if (filters.pageSize) params.append('pageSize', String(filters.pageSize));

    // Map status filter to active/expired booleans
    if (filters.status && filters.status !== 'all') {
        if (filters.status === 'active') {
            params.append('active', 'true');
        } else if (filters.status === 'expired') {
            params.append('expired', 'true');
        } else if (filters.status === 'inactive') {
            params.append('active', 'false');
        }
    }

    // Map search to codeSearch
    if (filters.search) {
        params.append('codeSearch', filters.search);
    }

    // Note: 'type' filter (percentage/fixed) is not supported by the API.
    // Client-side filtering is applied after fetching.

    return params;
}

/**
 * Fetch promo codes with filters
 */
async function fetchPromoCodes(filters: PromoCodeFilters = {}) {
    const params = buildPromoCodeParams(filters);

    const result = await fetchApi<{
        success: boolean;
        data: { items: Record<string, unknown>[]; pagination: Record<string, unknown> };
    }>({
        path: `/api/v1/protected/billing/promo-codes?${params.toString()}`
    });

    const responseData = result.data.data;
    let items = responseData.items ?? [];

    // Client-side filter for discount type (not supported by API)
    if (filters.type && filters.type !== 'all') {
        items = items.filter((item: Record<string, unknown>) => item.type === filters.type);
    }

    return { items, pagination: responseData.pagination ?? { total: items.length } };
}

/**
 * Create a new promo code
 */
async function createPromoCode(payload: CreatePromoCodePayload) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: '/api/v1/protected/billing/promo-codes',
        method: 'POST',
        body: payload
    });
    return result.data.data;
}

/**
 * Update an existing promo code
 */
async function updatePromoCode({ id, ...payload }: UpdatePromoCodePayload) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/protected/billing/promo-codes/${id}`,
        method: 'PUT',
        body: payload
    });
    return result.data.data;
}

/**
 * Toggle promo code active status
 */
async function togglePromoCodeActive(id: string, isActive: boolean) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/protected/billing/promo-codes/${id}`,
        method: 'PATCH',
        body: { isActive }
    });
    return result.data.data;
}

/**
 * Delete a promo code
 */
async function deletePromoCode(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/protected/billing/promo-codes/${id}`,
        method: 'DELETE'
    });
    return result.data.data;
}

/**
 * Hook to fetch promo codes
 */
export function usePromoCodesQuery(filters: PromoCodeFilters = {}) {
    return useQuery({
        queryKey: promoCodeQueryKeys.promoCodes.list(filters),
        queryFn: () => fetchPromoCodes(filters),
        staleTime: 60_000
    });
}

/**
 * Hook to create a new promo code
 */
export function useCreatePromoCodeMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: CreatePromoCodePayload) => createPromoCode(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: promoCodeQueryKeys.promoCodes.lists() });
        }
    });
}

/**
 * Hook to update a promo code
 */
export function useUpdatePromoCodeMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: UpdatePromoCodePayload) => updatePromoCode(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: promoCodeQueryKeys.promoCodes.lists() });
        }
    });
}

/**
 * Hook to toggle promo code active status
 */
export function useTogglePromoCodeActiveMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            togglePromoCodeActive(id, isActive),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: promoCodeQueryKeys.promoCodes.lists() });
        }
    });
}

/**
 * Hook to delete a promo code
 */
export function useDeletePromoCodeMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deletePromoCode(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: promoCodeQueryKeys.promoCodes.lists() });
        }
    });
}
