import { fetchApi } from '@/lib/api/client';
import { ApiError, reportError } from '@/lib/errors';
import { AdminBillingPlanResponseSchema, BillingPlanResponseSchema } from '@repo/schemas';
import type { BillingPlanResponse } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import type { CreatePlanPayload, ParsedPlanRecord, UpdatePlanPayload } from './types';

export type { ParsedPlanRecord } from './types';

/**
 * Zod schema for the list-endpoint envelope.
 * GET /api/v1/admin/billing/plans → { success, data: { items, pagination }, metadata }
 */
const PlanListResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        items: z.array(z.unknown()),
        pagination: z.record(z.string(), z.unknown())
    })
});

/**
 * Transform a raw API record (AdminBillingPlanResponse shape) to a ParsedPlanRecord.
 *
 * Validates the record against AdminBillingPlanResponseSchema — the admin list
 * route returns the base plan plus `isDeleted` and `activeSubscriptionCount` —
 * and surfaces schema mismatches as a 502 ApiError to the query layer,
 * consistent with the project's error-boundary convention for malformed
 * server responses.
 *
 * @param record - Raw unknown value from the API items array.
 * @returns Typed ParsedPlanRecord.
 * @throws ApiError(502) when the record does not match AdminBillingPlanResponseSchema.
 */
function transformPlanRecord(record: unknown): ParsedPlanRecord {
    const parseResult = AdminBillingPlanResponseSchema.safeParse(record);

    if (!parseResult.success) {
        const apiError = new ApiError('Plan record failed schema validation', {
            status: 502,
            code: 'BAD_REQUEST',
            details: { zodIssues: parseResult.error.issues }
        });
        reportError({
            error: apiError,
            source: 'billing-plans/transformPlanRecord',
            tags: { feature: 'billing', stage: 'response-parse' }
        });
        throw apiError;
    }

    const p = parseResult.data;

    return {
        id: p.id,
        name: p.name,
        description: p.description,
        slug: p.slug,
        category: p.category,
        isActive: p.isActive,
        isDefault: p.isDefault,
        sortOrder: p.sortOrder,
        hasTrial: p.hasTrial,
        trialDays: p.trialDays,
        monthlyPriceArs: p.monthlyPriceArs,
        annualPriceArs: p.annualPriceArs,
        monthlyPriceUsdRef: p.monthlyPriceUsdRef,
        entitlements: p.entitlements,
        // Convert Record<string, number> → { key, value }[] for DataTable
        limits: Object.entries(p.limits).map(([key, value]) => ({ key, value })),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        isDeleted: p.isDeleted,
        activeSubscriptionCount: p.activeSubscriptionCount
    };
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
 * Fetch plans with filters.
 *
 * Calls GET /api/v1/admin/billing/plans and transforms the items array using
 * BillingPlanResponseSchema validation. Throws on network errors or schema
 * mismatches.
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
        data: { items: unknown[]; pagination: Record<string, unknown> };
    }>({
        path: `/api/v1/admin/billing/plans?${params.toString()}`
    });

    const envelopeResult = PlanListResponseSchema.safeParse(result.data);
    if (!envelopeResult.success) {
        const apiError = new ApiError('Plan list response failed schema validation', {
            status: 502,
            code: 'BAD_REQUEST',
            details: { zodIssues: envelopeResult.error.issues }
        });
        reportError({
            error: apiError,
            source: 'billing-plans/fetchPlans',
            tags: { feature: 'billing', stage: 'response-parse' }
        });
        throw apiError;
    }

    const items = envelopeResult.data.data.items.map(transformPlanRecord);
    return { items, pagination: envelopeResult.data.data.pagination };
}

/**
 * Convert the dialog payload's `limits` (an array of `{ key, value }` pairs used
 * by the form UI) into the API contract's `Record<string, number>` map. The API
 * schemas (`Create/UpdateBillingPlanSchema`) model `limits` as `z.record(...)`,
 * so sending the array shape would be rejected with a 422.
 */
function toApiLimits<T extends { limits?: ReadonlyArray<{ key: string; value: number }> }>(
    payload: T
): Omit<T, 'limits'> & { limits?: Record<string, number> } {
    if (!payload.limits) {
        const { limits: _omit, ...rest } = payload;
        return rest;
    }
    return {
        ...payload,
        limits: Object.fromEntries(payload.limits.map((l) => [l.key, l.value]))
    };
}

/**
 * Create a new plan.
 *
 * POST /api/v1/admin/billing/plans — returns the created BillingPlanResponse.
 */
async function createPlan(payload: CreatePlanPayload): Promise<BillingPlanResponse> {
    const result = await fetchApi<{ success: boolean; data: unknown }>({
        path: '/api/v1/admin/billing/plans',
        method: 'POST',
        body: toApiLimits(payload)
    });
    const parsed = BillingPlanResponseSchema.safeParse(result.data.data);
    if (!parsed.success) {
        throw new ApiError('Create plan response failed schema validation', {
            status: 502,
            code: 'BAD_REQUEST'
        });
    }
    return parsed.data;
}

/**
 * Update an existing plan by UUID (slug is immutable per D1, absent from payload type).
 *
 * PUT /api/v1/admin/billing/plans/{id} — partial update, returns updated plan.
 */
async function updatePlan({ id, ...payload }: UpdatePlanPayload): Promise<BillingPlanResponse> {
    const result = await fetchApi<{ success: boolean; data: unknown }>({
        path: `/api/v1/admin/billing/plans/${id}`,
        method: 'PUT',
        body: toApiLimits(payload)
    });
    const parsed = BillingPlanResponseSchema.safeParse(result.data.data);
    if (!parsed.success) {
        throw new ApiError('Update plan response failed schema validation', {
            status: 502,
            code: 'BAD_REQUEST'
        });
    }
    return parsed.data;
}

/**
 * Toggle plan active status by UUID.
 *
 * PATCH /api/v1/admin/billing/plans/{id} with `{ active: boolean }`.
 */
async function togglePlanActive(id: string, isActive: boolean): Promise<void> {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/billing/plans/${id}`,
        method: 'PATCH',
        body: { active: isActive }
    });
}

/**
 * Soft-delete a plan by UUID.
 *
 * DELETE /api/v1/admin/billing/plans/{id}
 */
async function deletePlan(id: string): Promise<void> {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/billing/plans/${id}`,
        method: 'DELETE'
    });
}

/**
 * Restore a soft-deleted plan by UUID.
 *
 * POST /api/v1/admin/billing/plans/{id}/restore
 */
async function restorePlan(id: string): Promise<void> {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/billing/plans/${id}/restore`,
        method: 'POST'
    });
}

/**
 * Permanently delete a plan by UUID.
 *
 * DELETE /api/v1/admin/billing/plans/{id}/hard. The API returns 409 when the
 * plan is still referenced by subscriptions; that surfaces as an ApiError with
 * `status === 409`, which the calling hook maps to a specific toast.
 */
async function hardDeletePlan(id: string): Promise<void> {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/billing/plans/${id}/hard`,
        method: 'DELETE'
    });
}

/**
 * Hook to fetch plans with optional filters.
 *
 * Returns the parsed list of plans from BillingPlanResponse-shaped records.
 * Falls back to an empty items array only when the API itself returns empty;
 * schema mismatches are surfaced as query errors.
 */
export const usePlansQuery = (filters: Record<string, unknown> = {}) => {
    return useQuery({
        queryKey: planQueryKeys.plans.list(filters),
        queryFn: () => fetchPlans(filters),
        staleTime: 60_000
    });
};

/**
 * Hook to create a new plan.
 *
 * On success invalidates the list query so the table refreshes automatically.
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
 * Hook to update a plan by UUID.
 *
 * On success invalidates the list query and any cached detail.
 */
export const useUpdatePlanMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: UpdatePlanPayload) => updatePlan(payload),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: planQueryKeys.plans.lists() });
            queryClient.invalidateQueries({
                queryKey: planQueryKeys.plans.detail(variables.id)
            });
        }
    });
};

/**
 * Hook to toggle plan active status by UUID.
 *
 * On success invalidates the list query.
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
 * Hook to soft-delete a plan by UUID.
 *
 * On success invalidates the list query.
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

/**
 * Hook to restore a soft-deleted plan by UUID.
 *
 * On success invalidates the list query so the restored plan reappears in the
 * non-deleted view.
 */
export const useRestorePlanMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => restorePlan(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: planQueryKeys.plans.lists() });
        }
    });
};

/**
 * Hook to permanently delete a plan by UUID.
 *
 * On success invalidates the list query. A 409 from the API (plan still
 * referenced by subscriptions) propagates as an ApiError so the caller can
 * show a specific "blocked" toast; the list is left untouched in that case.
 */
export const useHardDeletePlanMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => hardDeletePlan(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: planQueryKeys.plans.lists() });
        }
    });
};
