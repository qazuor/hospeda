import { fetchApi } from '@/lib/api/client';
import type { Tag } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Query key factory for USER tag moderation queries.
 * Provides a consistent key structure for TanStack Query cache management.
 */
export const userTagModerationQueryKeys = {
    all: ['user-tags-moderation'] as const,
    lists: () => [...userTagModerationQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
        [...userTagModerationQueryKeys.lists(), filters] as const
};

/** Extended USER tag with owner info for moderation view. */
export interface UserTagWithOwner extends Tag {
    readonly ownerDisplayName?: string;
    readonly ownerEmail?: string;
    readonly ownerRole?: string;
    readonly usageCount?: number;
}

/** Shape of the paginated list API response for USER tags (moderation). */
interface UserTagModerationListResponse {
    readonly success: boolean;
    readonly data: {
        readonly items: UserTagWithOwner[];
        readonly pagination: {
            readonly page: number;
            readonly pageSize: number;
            readonly total: number;
            readonly totalPages: number;
        };
    };
}

/** Filters accepted by the USER tag moderation list endpoint. */
export interface UserTagModerationListFilters {
    readonly page?: number;
    readonly pageSize?: number;
    readonly search?: string;
    readonly lifecycleState?: string;
    readonly ownerId?: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchUserTagsList(filters: UserTagModerationListFilters) {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    if (filters.search) params.set('search', filters.search);
    if (filters.lifecycleState) params.set('lifecycleState', filters.lifecycleState);
    if (filters.ownerId) params.set('ownerId', filters.ownerId);

    const query = params.toString();
    const path = `/api/v1/admin/tags/user${query ? `?${query}` : ''}`;

    const result = await fetchApi<UserTagModerationListResponse>({ path });
    return result.data;
}

async function deleteUserTagRequest(id: string) {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/tags/user/${id}`,
        method: 'DELETE'
    });
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Fetches the paginated list of ALL USER tags for moderation.
 *
 * Gate: caller must have `TAG_VIEW_ALL_USER_TAGS` permission.
 *
 * @param filters - Pagination and filter parameters
 */
export function useUserTagModerationList(filters: UserTagModerationListFilters = {}) {
    return useQuery({
        queryKey: userTagModerationQueryKeys.list(filters as Record<string, unknown>),
        queryFn: () => fetchUserTagsList(filters),
        staleTime: 30_000
    });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/**
 * Mutation for hard-deleting any USER tag (moderation action).
 * Requires `TAG_USER_DELETE_ANY` permission on the server side.
 * Invalidates list cache on success.
 *
 * Per D-012: there is NO update/rename mutation for USER tags from admin.
 */
export function useDeleteAnyUserTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteUserTagRequest(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userTagModerationQueryKeys.lists() });
        }
    });
}
