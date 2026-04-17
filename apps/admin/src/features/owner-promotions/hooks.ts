import { fetchApi } from '@/lib/api/client';
import type { LifecycleStatusEnum } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateOwnerPromotionInput, UpdateOwnerPromotionInput } from './types';

/**
 * Query keys for owner promotion queries
 */
export const ownerPromotionQueryKeys = {
    all: ['owner-promotions'] as const,
    lists: () => [...ownerPromotionQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
        [...ownerPromotionQueryKeys.lists(), filters] as const,
    details: () => [...ownerPromotionQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...ownerPromotionQueryKeys.details(), id] as const
};

/**
 * Fetch owner promotions with filters
 */
async function fetchOwnerPromotions(filters: Record<string, unknown> = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
            params.append(key, String(value));
        }
    }

    const result = await fetchApi<{
        success: boolean;
        data: { items: Record<string, unknown>[]; pagination: Record<string, unknown> };
    }>({
        path: `/api/v1/admin/owner-promotions?${params.toString()}`
    });
    return result.data.data;
}

/**
 * Fetch single owner promotion
 */
async function fetchOwnerPromotion(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/owner-promotions/${id}`
    });
    return result.data.data;
}

/**
 * Create owner promotion
 */
async function createOwnerPromotion(data: CreateOwnerPromotionInput) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: '/api/v1/admin/owner-promotions',
        method: 'POST',
        body: data
    });
    return result.data.data;
}

/**
 * Update owner promotion
 */
async function updateOwnerPromotion(data: UpdateOwnerPromotionInput) {
    const { id, ...updateData } = data;

    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/owner-promotions/${id}`,
        method: 'PATCH',
        body: updateData
    });
    return result.data.data;
}

/**
 * Delete owner promotion
 */
async function deleteOwnerPromotion(id: string) {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/owner-promotions/${id}`,
        method: 'DELETE'
    });
    return true;
}

/**
 * Update owner promotion lifecycle state (DRAFT/ACTIVE/ARCHIVED).
 */
async function updatePromotionLifecycle(id: string, lifecycleState: LifecycleStatusEnum) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/owner-promotions/${id}`,
        method: 'PATCH',
        body: { lifecycleState }
    });
    return result.data.data;
}

/**
 * Hook to fetch owner promotions
 */
export const useOwnerPromotionsQuery = (filters: Record<string, unknown> = {}) => {
    return useQuery({
        queryKey: ownerPromotionQueryKeys.list(filters),
        queryFn: () => fetchOwnerPromotions(filters),
        staleTime: 30_000
    });
};

/**
 * Hook to fetch single owner promotion
 */
export const useOwnerPromotionQuery = (id: string) => {
    return useQuery({
        queryKey: ownerPromotionQueryKeys.detail(id),
        queryFn: () => fetchOwnerPromotion(id),
        staleTime: 60_000,
        enabled: !!id
    });
};

/**
 * Hook to create owner promotion
 */
export const useCreateOwnerPromotionMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createOwnerPromotion,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ownerPromotionQueryKeys.lists() });
        }
    });
};

/**
 * Hook to update owner promotion
 */
export const useUpdateOwnerPromotionMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateOwnerPromotion,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ownerPromotionQueryKeys.lists() });
            queryClient.invalidateQueries({
                queryKey: ownerPromotionQueryKeys.detail((data as { id: string }).id)
            });
        }
    });
};

/**
 * Hook to delete owner promotion
 */
export const useDeleteOwnerPromotionMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteOwnerPromotion,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ownerPromotionQueryKeys.lists() });
        }
    });
};

/**
 * Hook to update promotion lifecycle state.
 */
export const useUpdatePromotionLifecycleMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, lifecycleState }: { id: string; lifecycleState: LifecycleStatusEnum }) =>
            updatePromotionLifecycle(id, lifecycleState),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ownerPromotionQueryKeys.lists() });
            queryClient.invalidateQueries({
                queryKey: ownerPromotionQueryKeys.detail((data as { id: string }).id)
            });
        }
    });
};
