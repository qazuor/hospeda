import { fetchApi } from '@/lib/api/client';
import { ApiError, reportError } from '@/lib/errors';
import { AdminAddonResponseSchema } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import type {
    AddonCatalogFilters,
    CreateAddonPayload,
    ParsedAddonRecord,
    PurchasedAddon,
    PurchasedAddonFilters,
    PurchasedAddonsResponse,
    UpdateAddonPayload
} from './types';

// ---------------------------------------------------------------------------
// Catalog (admin addon definition) — NEW in T-021
// ---------------------------------------------------------------------------

/**
 * Zod schema for the catalog list-endpoint envelope.
 * GET /api/v1/admin/billing/addons → { success, data: { items, pagination }, metadata }
 */
const AddonCatalogListResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        items: z.array(z.unknown()),
        pagination: z.record(z.string(), z.unknown())
    })
});

/**
 * Transforms a raw API record to a ParsedAddonRecord.
 * Validates against AdminAddonResponseSchema and surfaces mismatches as ApiError.
 */
function transformAddonRecord(record: unknown): ParsedAddonRecord {
    const parseResult = AdminAddonResponseSchema.safeParse(record);

    if (!parseResult.success) {
        const apiError = new ApiError('Addon record failed schema validation', {
            status: 502,
            code: 'BAD_REQUEST',
            details: { zodIssues: parseResult.error.issues }
        });
        reportError({
            error: apiError,
            source: 'billing-addons/transformAddonRecord',
            tags: { feature: 'billing', stage: 'response-parse' }
        });
        throw apiError;
    }

    const a = parseResult.data;

    return {
        id: a.id,
        slug: a.slug,
        name: a.name,
        description: a.description,
        billingType: a.billingType,
        priceArs: a.priceArs,
        durationDays: a.durationDays,
        affectsLimitKey: a.affectsLimitKey,
        limitIncrease: a.limitIncrease,
        grantsEntitlement: a.grantsEntitlement,
        targetCategories: a.targetCategories,
        isActive: a.isActive,
        sortOrder: a.sortOrder,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        isDeleted: a.deletedAt !== null,
        deletedAt: a.deletedAt
    };
}

/**
 * Fetches the add-on catalog (admin definitions) with filters and pagination.
 *
 * Calls GET /api/v1/admin/billing/addons with the new paginated admin list endpoint.
 */
async function fetchAddonCatalog(filters: AddonCatalogFilters = {}) {
    const params = new URLSearchParams();

    if (filters.billingType) params.append('billingType', filters.billingType);
    if (filters.targetCategory) params.append('targetCategory', filters.targetCategory);
    if (filters.isActive !== undefined) params.append('isActive', String(filters.isActive));
    if (filters.includeDeleted) params.append('includeDeleted', 'true');
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.pageSize) params.append('pageSize', String(filters.pageSize));

    const result = await fetchApi<{
        success: boolean;
        data: { items: unknown[]; pagination: Record<string, unknown> };
    }>({
        path: `/api/v1/admin/billing/addons?${params.toString()}`
    });

    const envelopeResult = AddonCatalogListResponseSchema.safeParse(result.data);
    if (!envelopeResult.success) {
        const apiError = new ApiError('Addon catalog list response failed schema validation', {
            status: 502,
            code: 'BAD_REQUEST',
            details: { zodIssues: envelopeResult.error.issues }
        });
        reportError({
            error: apiError,
            source: 'billing-addons/fetchAddonCatalog',
            tags: { feature: 'billing', stage: 'response-parse' }
        });
        throw apiError;
    }

    const items = envelopeResult.data.data.items.map(transformAddonRecord);
    return { items, pagination: envelopeResult.data.data.pagination };
}

/**
 * Restores a soft-deleted add-on by UUID.
 *
 * POST /api/v1/admin/billing/addons/{id}/restore
 */
async function restoreAddon(id: string): Promise<void> {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/billing/addons/${id}/restore`,
        method: 'POST'
    });
}

/**
 * Permanently deletes an add-on by UUID.
 *
 * DELETE /api/v1/admin/billing/addons/{id}/hard.
 * The API returns 409 when the addon is still referenced by purchases;
 * that surfaces as an ApiError with `status === 409`.
 */
async function hardDeleteAddon(id: string): Promise<void> {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/billing/addons/${id}/hard`,
        method: 'DELETE'
    });
}

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
 */
async function fetchAddons(filters: Record<string, unknown> = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            params.append(key, String(value));
        }
    }

    const result = await fetchApi<{
        success: boolean;
        data: Record<string, unknown>[];
        metadata?: Record<string, unknown>;
    }>({
        path: `/api/v1/admin/billing/addons?${params.toString()}`
    });
    // Custom billing route returns { success, data: [] } without pagination
    const items = result.data.data;
    return { items, pagination: { total: Array.isArray(items) ? items.length : 0 } };
}

/** Raw envelope returned by the customer-addons list endpoint. */
interface CustomerAddonsApiEnvelope {
    data: PurchasedAddon[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

/**
 * Fetch purchased add-ons (customer add-ons).
 *
 * The API returns a flat `{ data, total, page, pageSize, totalPages }` envelope;
 * map it to the UI's `{ items, pagination }` shape (the previous direct cast was
 * wrong, so the table always rendered empty — SPEC-143 smoke F-ADMIN-ADDONS-LIST).
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

    const result = await fetchApi<{ success: boolean; data: CustomerAddonsApiEnvelope }>({
        path: `/api/v1/admin/billing/customer-addons?${params.toString()}`
    });

    const envelope = result.data.data;
    return {
        items: envelope.data ?? [],
        pagination: {
            total: envelope.total ?? 0,
            page: envelope.page ?? 1,
            limit: envelope.pageSize ?? filters.limit ?? 20,
            totalPages: envelope.totalPages ?? 0
        }
    };
}

/**
 * Create a new add-on
 */
async function createAddon(payload: CreateAddonPayload) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: '/api/v1/admin/billing/addons',
        method: 'POST',
        body: payload
    });
    return result.data.data;
}

/**
 * Update an existing add-on
 */
async function updateAddon({ id, ...payload }: UpdateAddonPayload) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/addons/${id}`,
        method: 'PUT',
        body: payload
    });
    return result.data.data;
}

/**
 * Toggle add-on active status.
 *
 * Uses `{ active: boolean }` body per the new CRUD admin route contract.
 */
async function toggleAddonActive(id: string, isActive: boolean) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/addons/${id}`,
        method: 'PATCH',
        body: { active: isActive }
    });
    return result.data.data;
}

/**
 * Delete an add-on
 */
async function deleteAddon(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/addons/${id}`,
        method: 'DELETE'
    });
    return result.data.data;
}

/**
 * Force expire a purchased add-on
 */
async function forceExpirePurchasedAddon(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/customer-addons/${id}/expire`,
        method: 'POST'
    });
    return result.data.data;
}

/**
 * Force activate a purchased add-on
 */
async function forceActivatePurchasedAddon(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/customer-addons/${id}/activate`,
        method: 'POST'
    });
    return result.data.data;
}

/**
 * Hook to fetch add-ons
 */
export const useAddonsQuery = (filters: Record<string, unknown> = {}) => {
    return useQuery({
        queryKey: addonQueryKeys.addons.list(filters),
        queryFn: () => fetchAddons(filters),
        staleTime: 60_000,
        retry: 1
    });
};

/**
 * Hook to fetch purchased add-ons (customer add-ons)
 */
export const usePurchasedAddonsQuery = (filters: PurchasedAddonFilters = {}) => {
    return useQuery({
        queryKey: addonQueryKeys.purchased.list(filters as Record<string, unknown>),
        queryFn: () => fetchPurchasedAddons(filters),
        staleTime: 60_000,
        retry: 1
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

// ---------------------------------------------------------------------------
// Catalog management hooks — NEW in T-021
// ---------------------------------------------------------------------------

export type { ParsedAddonRecord } from './types';

/**
 * Hook to fetch the add-on catalog (admin definitions) with filters and pagination.
 *
 * Uses the new paginated admin list endpoint that returns AdminAddonResponse items.
 * Falls back to an empty items array only when the API returns empty;
 * schema mismatches are surfaced as query errors.
 */
export const useAddonCatalogQuery = (filters: AddonCatalogFilters = {}) => {
    return useQuery({
        queryKey: addonQueryKeys.addons.list(filters as Record<string, unknown>),
        queryFn: () => fetchAddonCatalog(filters),
        staleTime: 60_000
    });
};

/**
 * Hook to restore a soft-deleted add-on by UUID.
 *
 * On success invalidates the catalog list query so the restored addon reappears.
 */
export const useRestoreAddonMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => restoreAddon(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: addonQueryKeys.addons.lists() });
        }
    });
};

/**
 * Hook to permanently delete an add-on by UUID.
 *
 * On success invalidates the catalog list query. A 409 from the API (addon still
 * referenced by purchases) propagates as an ApiError so the caller can show a
 * specific "blocked" toast; the list is left untouched in that case.
 */
export const useHardDeleteAddonMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => hardDeleteAddon(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: addonQueryKeys.addons.lists() });
        }
    });
};
