import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateOwnerPromotionInput, UpdateOwnerPromotionInput } from './types';

const API_BASE = '/api/v1';

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

    const response = await fetch(`${API_BASE}/public/owner-promotions?${params.toString()}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch owner promotions: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Fetch single owner promotion
 */
async function fetchOwnerPromotion(id: string) {
    const response = await fetch(`${API_BASE}/public/owner-promotions/${id}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch owner promotion: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Create owner promotion
 */
async function createOwnerPromotion(data: CreateOwnerPromotionInput) {
    const response = await fetch(`${API_BASE}/owner-promotions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
            error.message || `Failed to create owner promotion: ${response.statusText}`
        );
    }

    const json = await response.json();
    return json.data;
}

/**
 * Update owner promotion
 */
async function updateOwnerPromotion(data: UpdateOwnerPromotionInput) {
    const { id, ...updateData } = data;

    const response = await fetch(`${API_BASE}/owner-promotions/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(updateData)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
            error.message || `Failed to update owner promotion: ${response.statusText}`
        );
    }

    const json = await response.json();
    return json.data;
}

/**
 * Delete owner promotion
 */
async function deleteOwnerPromotion(id: string) {
    const response = await fetch(`${API_BASE}/owner-promotions/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
            error.message || `Failed to delete owner promotion: ${response.statusText}`
        );
    }

    return true;
}

/**
 * Toggle owner promotion active status
 */
async function togglePromotionActive(id: string, isActive: boolean) {
    const response = await fetch(`${API_BASE}/owner-promotions/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ isActive })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to update promotion: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
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
            queryClient.invalidateQueries({ queryKey: ownerPromotionQueryKeys.detail(data.id) });
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
 * Hook to toggle promotion active status
 */
export const useTogglePromotionActiveMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            togglePromotionActive(id, isActive),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ownerPromotionQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: ownerPromotionQueryKeys.detail(data.id) });
        }
    });
};
