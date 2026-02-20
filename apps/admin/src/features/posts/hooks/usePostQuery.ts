import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';

/**
 * Query keys for post operations
 */
export const postQueryKeys = {
    all: ['posts'] as const,
    lists: () => [...postQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...postQueryKeys.lists(), filters] as const,
    details: () => [...postQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...postQueryKeys.details(), id] as const
};

/**
 * Fetch a single post by ID
 */
async function fetchPost(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/public/posts/${id}`
    });
    return result.data.data;
}

/**
 * Update a post
 */
async function updatePost(id: string, data: Record<string, unknown>) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/protected/posts/${id}`,
        method: 'PATCH',
        body: data
    });
    return result.data.data;
}

/**
 * Create a new post
 */
async function createPost(data: Record<string, unknown>) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: '/api/v1/protected/posts',
        method: 'POST',
        body: data
    });
    return result.data.data;
}

/**
 * Delete a post (soft delete)
 */
async function deletePost(id: string) {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/posts/${id}`,
        method: 'DELETE'
    });
    return true;
}

/**
 * Hook to fetch a single post by ID
 */
export const usePostQuery = (id: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: postQueryKeys.detail(id),
        queryFn: () => fetchPost(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 30_000
    });
};

/**
 * Hook to update a post
 */
export const useUpdatePostMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => updatePost(id, data),
        onSuccess: (updatedData) => {
            adminLogger.debug('[PostMutation] Post updated successfully', {
                id,
                data: updatedData
            });

            // Update the cache with new data
            queryClient.setQueryData(postQueryKeys.detail(id), updatedData);
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: postQueryKeys.lists() });
        },
        onError: (error) => {
            adminLogger.error('[PostMutation] Failed to update post', { id, error });
        }
    });
};

/**
 * Hook to create a new post
 */
export const useCreatePostMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => createPost(data),
        onSuccess: (data) => {
            adminLogger.debug('[PostMutation] Post created successfully', data);

            // Invalidate list queries to refetch
            queryClient.invalidateQueries({ queryKey: postQueryKeys.lists() });
        },
        onError: (error) => {
            adminLogger.error('[PostMutation] Failed to create post', error);
        }
    });
};

/**
 * Hook to delete a post
 */
export const useDeletePostMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deletePost(id),
        onSuccess: (_data, id) => {
            adminLogger.debug('[PostMutation] Post deleted successfully', { id });

            // Remove from cache
            queryClient.removeQueries({ queryKey: postQueryKeys.detail(id) });
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: postQueryKeys.lists() });
        },
        onError: (error, id) => {
            adminLogger.error('[PostMutation] Failed to delete post', { id, error });
        }
    });
};
