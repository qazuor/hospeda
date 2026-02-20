import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';

const API_PATH = '/api/v1/admin/users';

/**
 * Query keys for user operations
 */
export const userQueryKeys = {
    all: ['users'] as const,
    lists: () => [...userQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...userQueryKeys.lists(), filters] as const,
    details: () => [...userQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...userQueryKeys.details(), id] as const
};

/**
 * Fetch a single user by ID
 */
async function fetchUser(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `${API_PATH}/${id}`
    });
    return result.data.data;
}

/**
 * Update a user
 */
async function updateUser(id: string, data: Record<string, unknown>) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `${API_PATH}/${id}`,
        method: 'PATCH',
        body: data
    });
    return result.data.data;
}

/**
 * Create a new user
 */
async function createUser(data: Record<string, unknown>) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: API_PATH,
        method: 'POST',
        body: data
    });
    return result.data.data;
}

/**
 * Delete a user (soft delete)
 */
async function deleteUser(id: string) {
    await fetchApi<{ success: boolean }>({
        path: `${API_PATH}/${id}`,
        method: 'DELETE'
    });
    return true;
}

/**
 * Hook to fetch a single user by ID
 */
export const useUserQuery = (id: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: userQueryKeys.detail(id),
        queryFn: () => fetchUser(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 30_000
    });
};

/**
 * Hook to update a user
 */
export const useUpdateUserMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => updateUser(id, data),
        onSuccess: (updatedData) => {
            adminLogger.debug('[UserMutation] User updated successfully', {
                id,
                data: updatedData
            });

            // Update the cache with new data
            queryClient.setQueryData(userQueryKeys.detail(id), updatedData);
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() });
        },
        onError: (error) => {
            adminLogger.error('[UserMutation] Failed to update user', { id, error });
        }
    });
};

/**
 * Hook to create a new user
 */
export const useCreateUserMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => createUser(data),
        onSuccess: (data) => {
            adminLogger.debug('[UserMutation] User created successfully', data);

            // Invalidate list queries to refetch
            queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() });
        },
        onError: (error) => {
            adminLogger.error('[UserMutation] Failed to create user', error);
        }
    });
};

/**
 * Hook to delete a user
 */
export const useDeleteUserMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteUser(id),
        onSuccess: (_data, id) => {
            adminLogger.debug('[UserMutation] User deleted successfully', { id });

            // Remove from cache
            queryClient.removeQueries({ queryKey: userQueryKeys.detail(id) });
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() });
        },
        onError: (error, id) => {
            adminLogger.error('[UserMutation] Failed to delete user', { id, error });
        }
    });
};
