import { fetchApi } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatePlanPayload, UpdatePlanPayload } from './types';

/**
 * Query keys for plan-related queries
 */
export const planQueryKeys = {
    plans: {
        all: ['billing-plans'] as const,
        lists: () => [...planQueryKeys.plans.all, 'list'] as const,
        list: (filters: Record<string, unknown>) =>
            [...planQueryKeys.plans.lists(), filters] as const,
        details: () => [...planQueryKeys.plans.all, 'detail'] as const,
        detail: (id: string) => [...planQueryKeys.plans.details(), id] as const
    }
};

/**
 * Fetch plans with filters
 */
async function fetchPlans(filters: Record<string, unknown> = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            params.append(key, String(value));
        }
    }

    const result = await fetchApi<{
        success: boolean;
        data: Record<string, unknown>[];
        pagination: Record<string, unknown>;
    }>({
        path: `/api/v1/billing/plans?${params.toString()}`
    });
    // QZPay returns { success, data: [], pagination } - transform to { items, pagination }
    return { items: result.data.data, pagination: result.data.pagination };
}

/**
 * Create a new plan
 */
async function createPlan(payload: CreatePlanPayload) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: '/api/v1/billing/plans',
        method: 'POST',
        body: payload
    });
    return result.data.data;
}

/**
 * Update an existing plan
 */
async function updatePlan({ id, ...payload }: UpdatePlanPayload) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/billing/plans/${id}`,
        method: 'PUT',
        body: payload
    });
    return result.data.data;
}

/**
 * Toggle plan active status
 */
async function togglePlanActive(id: string, isActive: boolean) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/billing/plans/${id}`,
        method: 'PATCH',
        body: { isActive }
    });
    return result.data.data;
}

/**
 * Delete a plan
 */
async function deletePlan(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/billing/plans/${id}`,
        method: 'DELETE'
    });
    return result.data.data;
}

/**
 * Hook to fetch plans
 */
export const usePlansQuery = (filters: Record<string, unknown> = {}) => {
    return useQuery({
        queryKey: planQueryKeys.plans.list(filters),
        queryFn: () => fetchPlans(filters),
        staleTime: 60_000
    });
};

/**
 * Hook to create a new plan
 */
export const useCreatePlanMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: CreatePlanPayload) => createPlan(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: planQueryKeys.plans.lists() });
        }
    });
};

/**
 * Hook to update a plan
 */
export const useUpdatePlanMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: UpdatePlanPayload) => updatePlan(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: planQueryKeys.plans.lists() });
        }
    });
};

/**
 * Hook to toggle plan active status
 */
export const useTogglePlanActiveMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            togglePlanActive(id, isActive),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: planQueryKeys.plans.lists() });
        }
    });
};

/**
 * Hook to delete a plan
 */
export const useDeletePlanMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deletePlan(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: planQueryKeys.plans.lists() });
        }
    });
};
