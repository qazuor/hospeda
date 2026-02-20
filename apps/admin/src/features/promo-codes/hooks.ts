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
 * Fetch promo codes with filters
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function fetchPromoCodes(filters: PromoCodeFilters = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            params.append(key, String(value));
        }
    }

    // TODO: Update endpoint when API is ready
    // Expected endpoint: GET /api/v1/billing/promo-codes
    const result = await fetchApi<{
        success: boolean;
        data: { items: Record<string, unknown>[]; pagination: Record<string, unknown> };
    }>({
        path: `/api/v1/billing/promo-codes?${params.toString()}`
    });
    return result.data.data;
}

/**
 * Create a new promo code
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function createPromoCode(payload: CreatePromoCodePayload) {
    // TODO: Update endpoint when API is ready
    // Expected endpoint: POST /api/v1/billing/promo-codes
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: '/api/v1/billing/promo-codes',
        method: 'POST',
        body: payload
    });
    return result.data.data;
}

/**
 * Update an existing promo code
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function updatePromoCode({ id, ...payload }: UpdatePromoCodePayload) {
    // TODO: Update endpoint when API is ready
    // Expected endpoint: PUT /api/v1/billing/promo-codes/:id
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/billing/promo-codes/${id}`,
        method: 'PUT',
        body: payload
    });
    return result.data.data;
}

/**
 * Toggle promo code active status
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function togglePromoCodeActive(id: string, isActive: boolean) {
    // TODO: Update endpoint when API is ready
    // Expected endpoint: PATCH /api/v1/billing/promo-codes/:id
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/billing/promo-codes/${id}`,
        method: 'PATCH',
        body: { isActive }
    });
    return result.data.data;
}

/**
 * Delete a promo code
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function deletePromoCode(id: string) {
    // TODO: Update endpoint when API is ready
    // Expected endpoint: DELETE /api/v1/billing/promo-codes/:id
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/billing/promo-codes/${id}`,
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
