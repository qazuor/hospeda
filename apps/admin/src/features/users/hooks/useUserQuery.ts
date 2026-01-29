import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminLogger } from '@/utils/logger';

/**
 * Query keys for user operations
 */
export const userQueryKeys = {
    all: ['users'] as const,
    lists: () => [...userQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...userQueryKeys.lists(), { filters }] as const,
    details: () => [...userQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...userQueryKeys.details(), id] as const
};

// Mock API functions - Replace with actual API calls
const mockFetchUser = async (id: string) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
        id,
        slug: `user-${id}`,
        displayName: `Usuario ${id}`,
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan@hospeda.com',
        phone: '+54 9 11 1234-5678',
        role: 'USER',
        permissions: [],
        authProvider: 'CLERK',
        visibility: 'PRIVATE',
        lifecycleState: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
};

const mockUpdateUser = async (id: string, data: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { id, ...data };
};

const mockCreateUser = async (data: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const id = crypto.randomUUID();
    return { id, ...data };
};

const mockDeleteUser = async (id: string) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { id, deleted: true };
};

/**
 * Hook to fetch a single user by ID
 */
export const useUserQuery = (id: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: userQueryKeys.detail(id),
        queryFn: () => mockFetchUser(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000 // 10 minutes (formerly cacheTime)
    });
};

/**
 * Hook to update a user
 */
export const useUpdateUserMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => mockUpdateUser(id, data),
        onSuccess: (data) => {
            adminLogger.debug('[UserMutation] User updated successfully', { id, data });

            // Invalidate and refetch
            queryClient.invalidateQueries({ queryKey: userQueryKeys.detail(id) });
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
        mutationFn: (data: Record<string, unknown>) => mockCreateUser(data),
        onSuccess: (data) => {
            adminLogger.debug('[UserMutation] User created successfully', data);

            // Invalidate list to show new user
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
        mutationFn: (id: string) => mockDeleteUser(id),
        onSuccess: (_data, id) => {
            adminLogger.debug('[UserMutation] User deleted successfully', { id });

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: userQueryKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() });
        },
        onError: (error, id) => {
            adminLogger.error('[UserMutation] Failed to delete user', { id, error });
        }
    });
};
