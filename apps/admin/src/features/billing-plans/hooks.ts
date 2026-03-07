import { fetchApi } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatePlanPayload, PlanDefinition, UpdatePlanPayload } from './types';

/**
 * QZPay API plan record shape
 */
interface QZPayPlanRecord {
    readonly id: string;
    readonly name: string;
    readonly description: string | null;
    readonly active: boolean;
    readonly entitlements: string[];
    readonly limits: Record<string, number>;
    readonly metadata: Record<string, unknown>;
    readonly createdAt: string;
    readonly updatedAt: string;
}

/**
 * Transform a QZPay plan record to PlanDefinition format
 */
function transformPlanRecord(record: QZPayPlanRecord): PlanDefinition & { id: string } {
    const meta = record.metadata ?? {};
    return {
        id: record.id,
        name: record.name,
        description: record.description ?? '',
        slug: (meta.slug as string) ?? '',
        category: (meta.category as PlanDefinition['category']) ?? 'owner',
        isActive: record.active,
        isDefault: (meta.isDefault as boolean) ?? false,
        sortOrder: (meta.sortOrder as number) ?? 0,
        hasTrial: (meta.hasTrial as boolean) ?? false,
        trialDays: (meta.trialDays as number) ?? 0,
        monthlyPriceArs: (meta.monthlyPriceArs as number) ?? 0,
        annualPriceArs: (meta.annualPriceArs as number) ?? null,
        monthlyPriceUsdRef: (meta.monthlyPriceUsdRef as number) ?? 0,
        entitlements: record.entitlements ?? [],
        limits: Object.entries(record.limits ?? {}).map(([key, value]) => ({
            key,
            value
        }))
    } as PlanDefinition & { id: string };
}

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
        data: QZPayPlanRecord[];
        pagination: Record<string, unknown>;
    }>({
        path: `/api/v1/protected/billing/plans?${params.toString()}`
    });

    // Transform QZPay records to PlanDefinition format
    const apiData = result.data.data ?? [];
    const items = apiData.map(transformPlanRecord);
    return { items, pagination: result.data.pagination };
}

/**
 * Create a new plan
 */
async function createPlan(payload: CreatePlanPayload) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: '/api/v1/protected/billing/plans',
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
        path: `/api/v1/protected/billing/plans/${id}`,
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
        path: `/api/v1/protected/billing/plans/${id}`,
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
        path: `/api/v1/protected/billing/plans/${id}`,
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
