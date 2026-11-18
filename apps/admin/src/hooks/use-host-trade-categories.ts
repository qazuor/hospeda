/**
 * @file use-host-trade-categories.ts
 * @description TanStack Query hooks for the provider trade category catalog
 * admin screen (HOS-919 T-043, T-044).
 *
 * Two catalogs, one shape: groups (`/host-trade-category-groups`) and
 * categories (`/host-trade-categories`) share the list envelope, the key
 * factory layout and the write verbs, so a small generic layer builds both.
 * Only `/api/v1/admin/*` endpoints are used.
 *
 * Writes follow the API contract: slugs are immutable, so `PATCH` bodies never
 * carry one, and a delete that hits live children or live providers answers
 * `409 CATEGORY_IN_USE` (the caller decides how to word it, see
 * {@link isCategoryInUseError}).
 */

import type {
    HostTradeCategoryAdmin,
    HostTradeCategoryCreateInput,
    HostTradeCategoryGroupAdmin,
    HostTradeCategoryGroupCreateInput,
    HostTradeCategoryGroupUpdateInput,
    HostTradeCategoryUpdateInput,
    LifecycleStatusEnum
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { isApiError } from '@/lib/errors';

/** Admin endpoint for category groups. */
export const HOST_TRADE_CATEGORY_GROUPS_ENDPOINT = '/api/v1/admin/host-trade-category-groups';

/** Admin endpoint for categories. */
export const HOST_TRADE_CATEGORIES_ENDPOINT = '/api/v1/admin/host-trade-categories';

/** Pagination metadata returned by the admin list routes. */
interface PaginationMeta {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
}

/** A page of catalog rows. */
export interface CatalogPage<TItem> {
    readonly items: TItem[];
    readonly pagination: PaginationMeta;
}

/** Filters accepted by the group list. */
export interface HostTradeCategoryGroupFilters {
    readonly page?: number;
    readonly pageSize?: number;
    readonly search?: string;
    readonly lifecycleState?: LifecycleStatusEnum;
    /** Also list soft-deleted rows (HOS-2340). Only sent when `true`. */
    readonly includeDeleted?: boolean;
}

/** Filters accepted by the category list (groups filters plus `groupId`). */
export interface HostTradeCategoryFilters extends HostTradeCategoryGroupFilters {
    readonly groupId?: string;
}

/**
 * Query keys for both catalogs. They share one root so a write on either side
 * can refresh the other: a category write changes a group's "in use" state.
 */
export const hostTradeCategoryQueryKeys = {
    all: ['host-trade-categories'] as const,
    groups: () => [...hostTradeCategoryQueryKeys.all, 'groups'] as const,
    groupList: (filters: HostTradeCategoryGroupFilters) =>
        [...hostTradeCategoryQueryKeys.groups(), filters] as const,
    categories: () => [...hostTradeCategoryQueryKeys.all, 'categories'] as const,
    categoryList: (filters: HostTradeCategoryFilters) =>
        [...hostTradeCategoryQueryKeys.categories(), filters] as const
};

/**
 * Whether an error is the API's `409 CATEGORY_IN_USE` refusal.
 *
 * Checks the status as well as the code: `ApiError.code` is typed to a closed
 * union that does not list this value, so it is compared as a string, and the
 * 409 status is the fallback when a proxy drops the body.
 *
 * @param error - Anything a mutation rejected with.
 */
export function isCategoryInUseError(error: unknown): boolean {
    if (!isApiError(error)) return false;
    return (error.code as string) === 'CATEGORY_IN_USE' || error.status === 409;
}

/**
 * Whether an error is the refusal to restore a category whose GROUP is still
 * soft-deleted (HOS-2340). The service answers a `VALIDATION_ERROR` naming the
 * `groupId` field; the 400/422 status is the fallback when the details are
 * dropped, since the category restore route has no other business refusal.
 *
 * @param error - Anything a restore mutation rejected with.
 */
export function isGroupStillDeletedError(error: unknown): boolean {
    if (!isApiError(error)) return false;
    if (error.details?.field === 'groupId') return true;
    return error.status === 400 || error.status === 422;
}

/** Serialises defined filters into a query string. A `false` boolean is omitted. */
function toQueryString(filters: Record<string, string | number | boolean | undefined>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === '' || value === false) continue;
        params.set(key, String(value));
    }
    const query = params.toString();
    return query ? `?${query}` : '';
}

/** Reads a list page from an admin endpoint. */
async function fetchPage<TItem>(
    endpoint: string,
    filters: Record<string, string | number | boolean | undefined>
): Promise<CatalogPage<TItem>> {
    const result = await fetchApi<{ success: boolean; data: CatalogPage<TItem> }>({
        path: `${endpoint}${toQueryString(filters)}`
    });
    return result.data.data;
}

/** Sends a write and returns the row the API answers with. */
async function writeRow<TItem>(input: {
    readonly path: string;
    readonly method: 'POST' | 'PATCH';
    readonly body: unknown;
}): Promise<TItem> {
    const result = await fetchApi<{ success: boolean; data: TItem }>({
        path: input.path,
        method: input.method,
        body: input.body
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

/**
 * Lists category groups.
 *
 * @param filters - Pagination, search and lifecycle filters.
 */
export const useHostTradeCategoryGroups = (filters: HostTradeCategoryGroupFilters = {}) =>
    useQuery({
        queryKey: hostTradeCategoryQueryKeys.groupList(filters),
        queryFn: () =>
            fetchPage<HostTradeCategoryGroupAdmin>(HOST_TRADE_CATEGORY_GROUPS_ENDPOINT, {
                ...filters
            })
    });

/** Creates a category group. */
export const useCreateHostTradeCategoryGroup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: HostTradeCategoryGroupCreateInput) =>
            writeRow<HostTradeCategoryGroupAdmin>({
                path: HOST_TRADE_CATEGORY_GROUPS_ENDPOINT,
                method: 'POST',
                body: data
            }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: hostTradeCategoryQueryKeys.all })
    });
};

/** Updates a category group. The body must not carry `slug`. */
export const useUpdateHostTradeCategoryGroup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: {
            readonly id: string;
            readonly data: HostTradeCategoryGroupUpdateInput;
        }) =>
            writeRow<HostTradeCategoryGroupAdmin>({
                path: `${HOST_TRADE_CATEGORY_GROUPS_ENDPOINT}/${input.id}`,
                method: 'PATCH',
                body: input.data
            }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: hostTradeCategoryQueryKeys.all })
    });
};

/** Soft-deletes a category group. Rejects with 409 while it has categories. */
export const useDeleteHostTradeCategoryGroup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await fetchApi<{ success: boolean }>({
                path: `${HOST_TRADE_CATEGORY_GROUPS_ENDPOINT}/${id}`,
                method: 'DELETE'
            });
            return id;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: hostTradeCategoryQueryKeys.all })
    });
};

/** Restores a soft-deleted category group (HOS-2340). */
export const useRestoreHostTradeCategoryGroup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await fetchApi<{ success: boolean }>({
                path: `${HOST_TRADE_CATEGORY_GROUPS_ENDPOINT}/${id}/restore`,
                method: 'POST'
            });
            return id;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: hostTradeCategoryQueryKeys.all })
    });
};

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * Lists categories.
 *
 * @param filters - Pagination, search, lifecycle and group filters.
 */
export const useHostTradeCategories = (filters: HostTradeCategoryFilters = {}) =>
    useQuery({
        queryKey: hostTradeCategoryQueryKeys.categoryList(filters),
        queryFn: () =>
            fetchPage<HostTradeCategoryAdmin>(HOST_TRADE_CATEGORIES_ENDPOINT, { ...filters })
    });

/** Creates a category. */
export const useCreateHostTradeCategory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: HostTradeCategoryCreateInput) =>
            writeRow<HostTradeCategoryAdmin>({
                path: HOST_TRADE_CATEGORIES_ENDPOINT,
                method: 'POST',
                body: data
            }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: hostTradeCategoryQueryKeys.all })
    });
};

/** Updates a category. The body must not carry `slug`. */
export const useUpdateHostTradeCategory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { readonly id: string; readonly data: HostTradeCategoryUpdateInput }) =>
            writeRow<HostTradeCategoryAdmin>({
                path: `${HOST_TRADE_CATEGORIES_ENDPOINT}/${input.id}`,
                method: 'PATCH',
                body: input.data
            }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: hostTradeCategoryQueryKeys.all })
    });
};

/**
 * Restores a soft-deleted category (HOS-2340). Rejects while its group is still
 * deleted, see {@link isGroupStillDeletedError}.
 */
export const useRestoreHostTradeCategory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await fetchApi<{ success: boolean }>({
                path: `${HOST_TRADE_CATEGORIES_ENDPOINT}/${id}/restore`,
                method: 'POST'
            });
            return id;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: hostTradeCategoryQueryKeys.all })
    });
};

/** Soft-deletes a category. Rejects with 409 while a provider uses it. */
export const useDeleteHostTradeCategory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await fetchApi<{ success: boolean }>({
                path: `${HOST_TRADE_CATEGORIES_ENDPOINT}/${id}`,
                method: 'DELETE'
            });
            return id;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: hostTradeCategoryQueryKeys.all })
    });
};
