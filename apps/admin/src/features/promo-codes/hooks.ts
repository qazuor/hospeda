import { fetchApi } from '@/lib/api/client';
import { type PromoEffect, PromoEffectKindEnum, ValueKindEnum } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    CreatePromoCodePayload,
    PromoCode,
    PromoCodeFilters,
    PromoCodeStatus,
    UpdatePromoCodePayload
} from './types';

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
 * Derive the UI status from the active flag and expiry date.
 */
function deriveStatus(active: boolean, expiresAt: string | null): PromoCodeStatus {
    if (!active) {
        return 'inactive';
    }
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
        return 'expired';
    }
    return 'active';
}

/**
 * Map an API response record to the UI PromoCode shape. `description` and
 * `minAmount` are unpacked from the response `metadata` object.
 */
function mapResponseToPromoCode(item: Record<string, unknown>): PromoCode {
    const metadata = (item.metadata as { description?: string; minAmount?: number } | null) ?? {};
    const expiresAt = (item.expiresAt as string | undefined) ?? null;
    const active = (item.active as boolean | undefined) ?? false;

    return {
        id: item.id as string,
        code: item.code as string,
        type: item.type as PromoCode['type'],
        value: (item.value as number | undefined) ?? 0,
        description: metadata.description ?? '',
        active,
        expiresAt,
        validFrom: (item.validFrom as string | undefined) ?? null,
        maxUses: (item.maxUses as number | undefined) ?? null,
        maxUsesPerUser: (item.maxUsesPerUser as number | undefined) ?? null,
        timesRedeemed: (item.timesRedeemed as number | undefined) ?? 0,
        validPlans: (item.validPlans as string[] | undefined) ?? [],
        newCustomersOnly: (item.newCustomersOnly as boolean | undefined) ?? false,
        isStackable: (item.isStackable as boolean | undefined) ?? false,
        minAmount: metadata.minAmount ?? null,
        status: deriveStatus(active, expiresAt),
        createdAt: item.createdAt as string | undefined,
        effect: (item.effect as PromoEffect | undefined) ?? undefined
    };
}

/**
 * Assemble the typed `effect` discriminated union (SPEC-262) from the form's
 * flat effect-state fields. Mirrors `PromoEffectSchema` in @repo/schemas.
 *
 * Exported so the form dialog can validate the same assembled object against
 * `PromoEffectSchema` client-side before submit (single source of assembly).
 */
export function buildEffect(payload: CreatePromoCodePayload): PromoEffect {
    if (payload.effectKind === 'trial_extension') {
        return { kind: PromoEffectKindEnum.TRIAL_EXTENSION, extraDays: payload.extraDays };
    }
    if (payload.effectKind === 'comp') {
        return { kind: PromoEffectKindEnum.COMP };
    }
    return {
        kind: PromoEffectKindEnum.DISCOUNT,
        valueKind: payload.valueKind === 'fixed' ? ValueKindEnum.FIXED : ValueKindEnum.PERCENTAGE,
        value: payload.discountValue,
        // `null` means "forever" — only emit it when the toggle is explicitly on.
        // A cleared cycles input must NOT silently become a forever discount.
        durationCycles: payload.durationForever ? null : (payload.durationCycles ?? 1)
    };
}

/**
 * Build the create request body from the form payload, omitting empty optional
 * fields so the API's `.optional()` (non-nullable) validators accept them.
 */
function toCreateRequestBody(payload: CreatePromoCodePayload): Record<string, unknown> {
    const body: Record<string, unknown> = {
        code: payload.code.toUpperCase(),
        effect: buildEffect(payload),
        isActive: payload.isActive,
        firstPurchaseOnly: payload.firstPurchaseOnly,
        isStackable: payload.isStackable
    };
    if (payload.description.trim()) {
        body.description = payload.description.trim();
    }
    if (payload.maxUses != null) {
        body.maxUses = payload.maxUses;
    }
    if (payload.maxUsesPerUser != null) {
        body.maxUsesPerUser = payload.maxUsesPerUser;
    }
    if (payload.validFrom) {
        body.validFrom = payload.validFrom;
    }
    if (payload.expiryDate) {
        body.expiryDate = payload.expiryDate;
    }
    if (payload.planRestrictions.length > 0) {
        body.planRestrictions = payload.planRestrictions;
    }
    if (payload.minAmount != null) {
        body.minAmount = payload.minAmount;
    }
    return body;
}

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
        path: `/api/v1/admin/billing/promo-codes?${params.toString()}`
    });

    const responseData = result.data.data;
    let items = (responseData.items ?? []).map(mapResponseToPromoCode);

    // Client-side filter for discount type (not supported by API)
    if (filters.type && filters.type !== 'all') {
        items = items.filter((item) => item.type === filters.type);
    }

    return { items, pagination: responseData.pagination ?? { total: items.length } };
}

/**
 * Create a new promo code
 */
async function createPromoCode(payload: CreatePromoCodePayload) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: '/api/v1/admin/billing/promo-codes',
        method: 'POST',
        body: toCreateRequestBody(payload)
    });
    return result.data.data;
}

/**
 * Update an existing promo code. The API only accepts mutable fields
 * (description, expiryDate, maxUses, isActive); empties are omitted.
 */
async function updatePromoCode({ id, ...payload }: UpdatePromoCodePayload) {
    const body: Record<string, unknown> = {};
    if (payload.description !== undefined) {
        body.description = payload.description;
    }
    if (payload.expiryDate) {
        body.expiryDate = payload.expiryDate;
    }
    if (payload.maxUses != null) {
        body.maxUses = payload.maxUses;
    }
    if (payload.isActive !== undefined) {
        body.isActive = payload.isActive;
    }

    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/promo-codes/${id}`,
        method: 'PUT',
        body
    });
    return result.data.data;
}

/**
 * Toggle promo code active status.
 *
 * Uses PUT (not PATCH) because the Hospeda backend route is registered as
 * `PUT /api/v1/admin/billing/promo-codes/:id` via `createAdminRoute`. The
 * UpdatePromoCodeSchema accepts a partial body, so sending just `{ isActive }`
 * is supported.
 */
async function togglePromoCodeActive(id: string, isActive: boolean) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/promo-codes/${id}`,
        method: 'PUT',
        body: { isActive }
    });
    return result.data.data;
}

/**
 * Delete a promo code
 */
async function deletePromoCode(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/promo-codes/${id}`,
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
