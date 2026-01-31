import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatePlanPayload, UpdatePlanPayload } from './types';

const API_BASE = '/api/v1';

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
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function fetchPlans(filters: Record<string, unknown> = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            params.append(key, String(value));
        }
    }

    // TODO: Update endpoint when API is ready
    // Expected endpoint: GET /api/v1/billing/plans
    const response = await fetch(`${API_BASE}/billing/plans?${params.toString()}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch plans: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Create a new plan
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function createPlan(payload: CreatePlanPayload) {
    // TODO: Update endpoint when API is ready
    // Expected endpoint: POST /api/v1/billing/plans
    const response = await fetch(`${API_BASE}/billing/plans`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to create plan: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Update an existing plan
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function updatePlan({ id, ...payload }: UpdatePlanPayload) {
    // TODO: Update endpoint when API is ready
    // Expected endpoint: PUT /api/v1/billing/plans/:id
    const response = await fetch(`${API_BASE}/billing/plans/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to update plan: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Toggle plan active status
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function togglePlanActive(id: string, isActive: boolean) {
    // TODO: Update endpoint when API is ready
    // Expected endpoint: PATCH /api/v1/billing/plans/:id
    const response = await fetch(`${API_BASE}/billing/plans/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ isActive })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to toggle plan: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Delete a plan
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function deletePlan(id: string) {
    // TODO: Update endpoint when API is ready
    // Expected endpoint: DELETE /api/v1/billing/plans/:id
    const response = await fetch(`${API_BASE}/billing/plans/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to delete plan: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
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
