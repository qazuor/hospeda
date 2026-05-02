import { useHasPermission } from '@/hooks/use-user-permissions';
import { fetchApi } from '@/lib/api/client';
import type { Tag } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

/**
 * Query key factory for picker tag queries.
 */
export const pickerTagQueryKeys = {
    all: ['picker-tags'] as const,
    system: (search?: string) => [...pickerTagQueryKeys.all, 'system', search ?? ''] as const,
    internal: (search?: string) => [...pickerTagQueryKeys.all, 'internal', search ?? ''] as const,
    userOwn: (search?: string) => [...pickerTagQueryKeys.all, 'user-own', search ?? ''] as const
};

/** API response shape for a flat tag list (non-paginated for picker). */
interface PickerTagListResponse {
    readonly success: boolean;
    readonly data: Tag[];
}

/** Grouped tag result returned by `usePickerTags`. */
export interface PickerTagGroup {
    readonly system: Tag[];
    readonly internal: Tag[];
    readonly userOwn: Tag[];
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchSystemTags(search?: string) {
    const params = new URLSearchParams({ pageSize: '100' });
    if (search) params.set('search', search);

    const result = await fetchApi<PickerTagListResponse>({
        path: `/api/v1/admin/tags/system?${params.toString()}`
    });
    return result.data.data ?? [];
}

async function fetchInternalTags(search?: string) {
    const params = new URLSearchParams({ pageSize: '100' });
    if (search) params.set('search', search);

    const result = await fetchApi<PickerTagListResponse>({
        path: `/api/v1/admin/tags/internal?${params.toString()}`
    });
    return result.data.data ?? [];
}

async function fetchOwnUserTagsForPicker(search?: string) {
    const params = new URLSearchParams({ pageSize: '100', lifecycleState: 'ACTIVE' });
    if (search) params.set('search', search);

    const result = await fetchApi<PickerTagListResponse>({
        path: `/api/v1/admin/tags/own?${params.toString()}`
    });

    // The own tags endpoint is paginated — normalize to array.
    // TYPE-WORKAROUND: fetchApi returns the endpoint's success-wrapped envelope but the picker shape is unique to this hook; cast then narrow on raw.data.items below.
    const raw = result.data as unknown as {
        data?: { items?: Tag[] };
        success?: boolean;
    };

    if (raw?.data?.items) {
        return raw.data.items;
    }

    // Fallback if endpoint returns flat array
    // TYPE-WORKAROUND: legacy non-paginated shape kept for backward compat; runtime guard above already routes the paginated path.
    return (result.data.data as unknown as Tag[]) ?? [];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches SYSTEM, INTERNAL (permission-gated), and own USER tags for
 * the tag picker. Returns a grouped result ready for rendering.
 *
 * INTERNAL tags are fetched only when the actor has `TAG_INTERNAL_VIEW`
 * (D-024, D-006, D-008).
 *
 * Search string is debounced at the caller level (e.g. in `TagPicker`).
 *
 * @param search - Optional search string (passed to safeIlike on the server, D-014)
 */
export function usePickerTags(search?: string): {
    groups: PickerTagGroup;
    isLoading: boolean;
} {
    const canViewInternal = useHasPermission(PermissionEnum.TAG_INTERNAL_VIEW);

    const systemQuery = useQuery({
        queryKey: pickerTagQueryKeys.system(search),
        queryFn: () => fetchSystemTags(search),
        staleTime: 60_000
    });

    const internalQuery = useQuery({
        queryKey: pickerTagQueryKeys.internal(search),
        queryFn: () => fetchInternalTags(search),
        enabled: canViewInternal,
        staleTime: 60_000
    });

    const ownQuery = useQuery({
        queryKey: pickerTagQueryKeys.userOwn(search),
        queryFn: () => fetchOwnUserTagsForPicker(search),
        staleTime: 30_000
    });

    const groups = useMemo<PickerTagGroup>(
        () => ({
            system: systemQuery.data ?? [],
            internal: canViewInternal ? (internalQuery.data ?? []) : [],
            userOwn: ownQuery.data ?? []
        }),
        [systemQuery.data, internalQuery.data, ownQuery.data, canViewInternal]
    );

    const isLoading =
        systemQuery.isLoading || (canViewInternal && internalQuery.isLoading) || ownQuery.isLoading;

    return { groups, isLoading };
}
