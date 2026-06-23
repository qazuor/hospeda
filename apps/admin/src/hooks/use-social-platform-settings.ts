/**
 * @file use-social-platform-settings.ts
 * @description TanStack Query hooks for social platform-formats and settings (SPEC-254 T-021).
 *
 * Separate from use-social-catalog.ts (which handles the five CRUD-full catalog entities)
 * because these two entities are edit-only: no create, no delete.
 *
 * API routes consumed (all under /api/v1/admin/social/):
 *   GET   /platform-formats       — list all (active + inactive)
 *   PATCH /platform-formats/:id   — update config fields
 *   GET   /settings               — list all (secret values masked as '***')
 *   PATCH /settings/:key          — update value field by key
 */

import { fetchApi } from '@/lib/api/client';
import type {
    SocialPlatformFormat,
    SocialPlatformFormatUpdate,
    SocialSetting
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** Standard pagination metadata returned by admin list endpoints. */
interface PaginationMeta {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
}

/** Wrapper returned by every admin list endpoint. */
interface ListResponse<T> {
    readonly success: boolean;
    readonly data: {
        readonly items: T[];
        readonly pagination: PaginationMeta;
    };
}

/** Wrapper returned by single-item endpoints. */
interface ItemResponse<T> {
    readonly success: boolean;
    readonly data: T;
}

/** List filter params for platform-formats and settings. */
export interface PlatformSettingsListFilters {
    readonly page?: number;
    readonly pageSize?: number;
    readonly search?: string;
}

// ---------------------------------------------------------------------------
// Generic helper
// ---------------------------------------------------------------------------

function buildSearchParams(filters: PlatformSettingsListFilters): URLSearchParams {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    if (filters.search) params.set('search', filters.search);
    return params;
}

async function fetchList<T>(
    base: string,
    filters: PlatformSettingsListFilters
): Promise<ListResponse<T>['data']> {
    const params = buildSearchParams(filters);
    const qs = params.toString();
    const path = qs ? `${base}?${qs}` : base;
    const result = await fetchApi<ListResponse<T>>({ path });
    return result.data.data;
}

async function patchItem<TBody, TItem>(base: string, idOrKey: string, body: TBody): Promise<TItem> {
    const result = await fetchApi<ItemResponse<TItem>>({
        path: `${base}/${idOrKey}`,
        method: 'PATCH',
        body
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// PLATFORM FORMATS
// ---------------------------------------------------------------------------

const PLATFORM_FORMATS_BASE = '/api/v1/admin/social/platform-formats';

export const socialPlatformFormatQueryKeys = {
    all: ['social-platform-formats'] as const,
    lists: () => [...socialPlatformFormatQueryKeys.all, 'list'] as const,
    list: (f: PlatformSettingsListFilters) => [...socialPlatformFormatQueryKeys.lists(), f] as const
};

/**
 * Fetches the paginated list of social platform format config rows.
 * Returns all rows (active + inactive). Gate: SOCIAL_PLATFORM_FORMAT_VIEW (server-side).
 *
 * @param filters - Optional pagination and search filters.
 */
export function usePlatformFormatsList(filters: PlatformSettingsListFilters = {}) {
    return useQuery({
        queryKey: socialPlatformFormatQueryKeys.list(filters),
        queryFn: () => fetchList<SocialPlatformFormat>(PLATFORM_FORMATS_BASE, filters),
        staleTime: 30_000
    });
}

/**
 * Updates an existing platform format config row (edit-only — no create or delete).
 * Gate: SOCIAL_PLATFORM_MANAGE (server-side).
 * When disabling a format (enabled: false) the API response may include a warnings array
 * indicating how many active targets still reference this format.
 *
 * @returns A TanStack mutation that accepts `{ id, input }`.
 */
export function useUpdatePlatformFormat() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            input
        }: {
            readonly id: string;
            readonly input: SocialPlatformFormatUpdate;
        }) =>
            patchItem<SocialPlatformFormatUpdate, SocialPlatformFormat>(
                PLATFORM_FORMATS_BASE,
                id,
                input
            ),
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: socialPlatformFormatQueryKeys.lists()
            });
        }
    });
}

// ---------------------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------------------

const SETTINGS_BASE = '/api/v1/admin/social/settings';

export const socialSettingQueryKeys = {
    all: ['social-settings'] as const,
    lists: () => [...socialSettingQueryKeys.all, 'list'] as const,
    list: (f: PlatformSettingsListFilters) => [...socialSettingQueryKeys.lists(), f] as const
};

/**
 * Fetches the paginated list of social automation settings.
 * Secret-typed values arrive already masked as '***' from the service.
 * Gate: SOCIAL_SETTINGS_MANAGE (server-side).
 *
 * @param filters - Optional pagination and search filters.
 */
export function useSocialSettingsList(filters: PlatformSettingsListFilters = {}) {
    return useQuery({
        queryKey: socialSettingQueryKeys.list(filters),
        queryFn: () => fetchList<SocialSetting>(SETTINGS_BASE, filters),
        staleTime: 30_000
    });
}

/**
 * Updates the value of a social setting identified by its unique string key.
 * Edit-only — no create or delete. Gate: SOCIAL_SETTINGS_MANAGE (server-side).
 *
 * @returns A TanStack mutation that accepts `{ key, value }`.
 */
export function useUpdateSocialSetting() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ key, value }: { readonly key: string; readonly value: string }) =>
            patchItem<{ value: string }, SocialSetting>(SETTINGS_BASE, key, { value }),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: socialSettingQueryKeys.lists() });
        }
    });
}
