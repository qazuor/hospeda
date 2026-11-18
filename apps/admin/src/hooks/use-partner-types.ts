/**
 * @file use-partner-types.ts
 * @description TanStack Query hooks for the partner type catalog admin screen
 * and for every admin surface that picks a partner type (HOS-2336).
 *
 * Only `/api/v1/admin/partner-types` is used: the admin panel never reads the
 * public catalog. Slugs are immutable, so `PATCH` bodies never carry one.
 * Deactivating or deleting a type that partners still use answers
 * `409 PARTNER_TYPE_IN_USE` with a public `details.count`
 * ({@link readPartnerTypeInUse}).
 */

import type {
    LifecycleStatusEnum,
    PartnerTypeAdminListItem,
    PartnerTypeCreateInput,
    PartnerTypeUpdateInput
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { isApiError } from '@/lib/errors';
import { resolveI18nText } from '@/utils/i18n-text';

/** Admin endpoint for the partner type catalog. */
export const PARTNER_TYPES_ENDPOINT = '/api/v1/admin/partner-types';

/** The API's maximum page size; the catalog is a handful of rows. */
export const PARTNER_TYPES_PAGE_SIZE = 100;

/** Pagination metadata returned by the admin list route. */
interface PaginationMeta {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
}

/** A page of partner type rows, each with its partner count. */
export interface PartnerTypePage {
    readonly items: PartnerTypeAdminListItem[];
    readonly pagination: PaginationMeta;
}

/** Filters accepted by the admin list. */
export interface PartnerTypeFilters {
    readonly page?: number;
    readonly pageSize?: number;
    readonly search?: string;
    readonly lifecycleState?: LifecycleStatusEnum;
    /** "Mostrar borrados": include soft-deleted rows (needed to restore one). */
    readonly includeDeleted?: boolean;
}

/** Query keys. Every write invalidates `all`, which also refreshes the pickers. */
export const partnerTypeQueryKeys = {
    all: ['partner-types'] as const,
    list: (filters: PartnerTypeFilters) => [...partnerTypeQueryKeys.all, 'list', filters] as const
};

/** The error code the API answers when a type in use is deactivated or deleted. */
export const PARTNER_TYPE_IN_USE_CODE = 'PARTNER_TYPE_IN_USE';

/**
 * Reads a `409 PARTNER_TYPE_IN_USE` refusal.
 *
 * Compares the code, never the bare status: another 409 (a duplicate slug)
 * must not read as "in use". `ApiError.code` is typed to a closed union that
 * does not list this value, so it is compared as a string.
 *
 * @param input - Object with anything a mutation rejected with.
 * @returns `{ inUse: true, count }` for the refusal (count `null` when the
 *   body carried none), `{ inUse: false, count: null }` otherwise.
 */
export function readPartnerTypeInUse({ error }: { readonly error: unknown }): {
    readonly inUse: boolean;
    readonly count: number | null;
} {
    if (!isApiError(error) || (error.code as string) !== PARTNER_TYPE_IN_USE_CODE) {
        return { inUse: false, count: null };
    }
    const count = error.details?.count;
    return { inUse: true, count: typeof count === 'number' ? count : null };
}

/** Serialises defined filters into a query string. */
function toQueryString(filters: PartnerTypeFilters): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== '') params.set(key, String(value));
    }
    const query = params.toString();
    return query ? `?${query}` : '';
}

/**
 * Reads one page of the admin catalog.
 *
 * @param filters - Pagination, search, lifecycle and deleted filters.
 */
export async function fetchPartnerTypePage(filters: PartnerTypeFilters): Promise<PartnerTypePage> {
    const result = await fetchApi<{ success: boolean; data: PartnerTypePage }>({
        path: `${PARTNER_TYPES_ENDPOINT}${toQueryString(filters)}`
    });
    return result.data.data;
}

/** Sends a write and returns the row the API answers with. */
async function writeRow(input: {
    readonly path: string;
    readonly method: 'POST' | 'PATCH';
    readonly body?: unknown;
}): Promise<PartnerTypeAdminListItem> {
    const result = await fetchApi<{ success: boolean; data: PartnerTypeAdminListItem }>({
        path: input.path,
        method: input.method,
        body: input.body
    });
    return result.data.data;
}

/**
 * Lists partner types.
 *
 * @param filters - Pagination, search, lifecycle and deleted filters.
 */
export const usePartnerTypes = (filters: PartnerTypeFilters = {}) =>
    useQuery({
        queryKey: partnerTypeQueryKeys.list(filters),
        queryFn: () => fetchPartnerTypePage(filters)
    });

/** Creates a partner type (stored ACTIVE unless the body says otherwise). */
export const useCreatePartnerType = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: PartnerTypeCreateInput) =>
            writeRow({ path: PARTNER_TYPES_ENDPOINT, method: 'POST', body: data }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: partnerTypeQueryKeys.all })
    });
};

/** Updates a partner type. Deactivating one in use rejects with 409. */
export const useUpdatePartnerType = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { readonly id: string; readonly data: PartnerTypeUpdateInput }) =>
            writeRow({
                path: `${PARTNER_TYPES_ENDPOINT}/${input.id}`,
                method: 'PATCH',
                body: input.data
            }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: partnerTypeQueryKeys.all })
    });
};

/** Soft-deletes a partner type. Rejects with 409 while a partner uses it. */
export const useDeletePartnerType = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await fetchApi<{ success: boolean }>({
                path: `${PARTNER_TYPES_ENDPOINT}/${id}`,
                method: 'DELETE'
            });
            return id;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: partnerTypeQueryKeys.all })
    });
};

/** Restores a soft-deleted partner type with its old slug and lifecycle state. */
export const useRestorePartnerType = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            writeRow({ path: `${PARTNER_TYPES_ENDPOINT}/${id}/restore`, method: 'POST' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: partnerTypeQueryKeys.all })
    });
};

/** Display name of a catalog row: its own `nameI18n` (es → en → pt), else its slug. */
export const partnerTypeName = (row: Pick<PartnerTypeAdminListItem, 'nameI18n' | 'slug'>) =>
    resolveI18nText(row.nameI18n) || row.slug;

/** One selectable partner type for a form `<select>`. */
export interface PartnerTypeOption {
    /** The type id the API receives as `typeId`. */
    readonly value: string;
    readonly slug: string;
    /** Display name resolved from the row's own `nameI18n`. */
    readonly label: string;
    /** True for an inactive type kept only because it is the current one. */
    readonly inactive: boolean;
}

/**
 * Turns catalog rows into form options: every ACTIVE type, plus the record's
 * current type even when inactive (HOS-2336 AC-4.1), so saving other fields
 * never forces a type change. Rows arrive ordered by weight from the API.
 *
 * @param input - Catalog rows and the current type id.
 */
export function toPartnerTypeOptions({
    rows,
    currentTypeId
}: {
    readonly rows: readonly PartnerTypeAdminListItem[];
    readonly currentTypeId?: string | null;
}): PartnerTypeOption[] {
    return rows
        .filter((row) => !row.deletedAt)
        .filter((row) => row.lifecycleState === 'ACTIVE' || row.id === currentTypeId)
        .map((row) => ({
            value: row.id,
            slug: row.slug,
            label: partnerTypeName(row),
            inactive: row.lifecycleState !== 'ACTIVE'
        }));
}

/**
 * Loads the catalog for a partner type picker (partner form, application
 * approval dialog).
 *
 * @param input - The record's current type id, kept selectable when inactive.
 */
export const usePartnerTypeOptions = ({
    currentTypeId
}: {
    readonly currentTypeId?: string | null;
} = {}) => {
    const query = usePartnerTypes({ page: 1, pageSize: PARTNER_TYPES_PAGE_SIZE });
    return {
        options: toPartnerTypeOptions({ rows: query.data?.items ?? [], currentTypeId }),
        isLoading: query.isLoading,
        isError: query.isError
    };
};
