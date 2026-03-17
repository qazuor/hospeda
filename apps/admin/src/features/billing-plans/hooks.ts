import { fetchApi } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import type { CreatePlanPayload, UpdatePlanPayload } from './types';

/**
 * Parsed plan record shape returned by transformPlanRecord.
 * Uses plain string arrays for entitlements and simplified limit objects,
 * since QZPay records don't carry the full LimitDefinition type.
 */
interface ParsedPlanRecord {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly slug: string;
    readonly category: 'owner' | 'complex' | 'tourist';
    readonly isActive: boolean;
    readonly isDefault: boolean;
    readonly sortOrder: number;
    readonly hasTrial: boolean;
    readonly trialDays: number;
    readonly monthlyPriceArs: number;
    readonly annualPriceArs: number | null;
    readonly monthlyPriceUsdRef: number;
    readonly entitlements: readonly string[];
    readonly limits: readonly { readonly key: string; readonly value: number }[];
}

/**
 * Zod schema for the metadata sub-object inside a QZPay plan record.
 * Each field has a safe default so a missing metadata property won't crash.
 */
const QZPayMetadataSchema = z.object({
    slug: z.string().default(''),
    category: z.enum(['owner', 'complex', 'tourist']).default('owner'),
    isDefault: z.boolean().default(false),
    sortOrder: z.number().default(0),
    hasTrial: z.boolean().default(false),
    trialDays: z.number().default(0),
    monthlyPriceArs: z.number().default(0),
    annualPriceArs: z.number().nullable().default(null),
    monthlyPriceUsdRef: z.number().default(0)
});

/**
 * Zod schema for validating a QZPay plan record before transformation.
 * Replaces unsafe `as` casts with runtime validation.
 */
const QZPayPlanRecordSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().default(null),
    active: z.boolean(),
    entitlements: z.array(z.string()).default([]),
    limits: z.record(z.string(), z.number()).default({}),
    metadata: z.unknown().transform((val) => {
        const parsed = QZPayMetadataSchema.safeParse(val ?? {});
        return parsed.success ? parsed.data : QZPayMetadataSchema.parse({});
    }),
    createdAt: z.string(),
    updatedAt: z.string()
});

/**
 * Transform a QZPay plan record to a parsed plan format using Zod validation.
 * Throws a clear error if the record does not match the expected schema.
 */
function transformPlanRecord(record: unknown): ParsedPlanRecord {
    const parseResult = QZPayPlanRecordSchema.safeParse(record);

    if (!parseResult.success) {
        console.warn('[billing-plans] Failed to parse plan record:', parseResult.error.flatten());
        throw new Error(
            `Invalid plan record from API: ${parseResult.error.issues.map((i) => i.message).join(', ')}`
        );
    }

    const parsed = parseResult.data;
    const meta = parsed.metadata;

    return {
        id: parsed.id,
        name: parsed.name,
        description: parsed.description ?? '',
        slug: meta.slug,
        category: meta.category,
        isActive: parsed.active,
        isDefault: meta.isDefault,
        sortOrder: meta.sortOrder,
        hasTrial: meta.hasTrial,
        trialDays: meta.trialDays,
        monthlyPriceArs: meta.monthlyPriceArs,
        annualPriceArs: meta.annualPriceArs,
        monthlyPriceUsdRef: meta.monthlyPriceUsdRef,
        entitlements: parsed.entitlements,
        limits: Object.entries(parsed.limits).map(([key, value]) => ({
            key,
            value
        }))
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
        data: unknown[];
        pagination: Record<string, unknown>;
    }>({
        path: `/api/v1/admin/billing/plans?${params.toString()}`
    });

    // Transform and validate API records using Zod schema
    const apiData = result.data.data ?? [];
    const items = apiData.map(transformPlanRecord);
    return { items, pagination: result.data.pagination };
}

/**
 * Create a new plan
 */
async function createPlan(payload: CreatePlanPayload) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: '/api/v1/admin/billing/plans',
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
        path: `/api/v1/admin/billing/plans/${id}`,
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
        path: `/api/v1/admin/billing/plans/${id}`,
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
        path: `/api/v1/admin/billing/plans/${id}`,
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
