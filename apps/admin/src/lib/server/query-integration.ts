/**
 * @file TanStack Query Integration with Server Functions
 *
 * This file provides seamless integration between TanStack Start server functions
 * and TanStack Query for optimal caching, invalidation, and data synchronization.
 */

import type {
    QueryClient,
    QueryKey,
    UseMutationOptions,
    UseQueryOptions
} from '@tanstack/react-query';
import type { ListQueryParams, ListResult, ServerFunctionResult } from './types';

/**
 * Query key factory for consistent cache management
 */
export const createQueryKeyFactory = (entityName: string) => ({
    all: [entityName] as const,
    lists: () => [entityName, 'list'] as const,
    list: (params: ListQueryParams) => [entityName, 'list', params] as const,
    details: () => [entityName, 'detail'] as const,
    detail: (id: string) => [entityName, 'detail', id] as const,
    relations: (id: string) => [entityName, 'relations', id] as const,
    relation: (id: string, relationKey: string) =>
        [entityName, 'relations', id, relationKey] as const,
    mutations: () => [entityName, 'mutations'] as const,
    mutation: (operation: string) => [entityName, 'mutations', operation] as const
});

/**
 * Server function wrapper that integrates with TanStack Query
 */
export type QueryIntegratedServerFunction<TInput, TOutput> = {
    readonly serverFn: (input: TInput) => Promise<ServerFunctionResult<TOutput>>;
    readonly queryKey: QueryKey;
    readonly invalidates?: readonly QueryKey[];
    readonly optimisticUpdate?: (queryClient: QueryClient, input: TInput) => void;
};

/**
 * Create query options for entity detail
 */
export const createEntityDetailQuery = <TData>(
    entityName: string,
    id: string,
    serverFn: (id: string) => Promise<ServerFunctionResult<TData>>,
    options?: Partial<UseQueryOptions<ServerFunctionResult<TData>, Error, TData>>
): UseQueryOptions<ServerFunctionResult<TData>, Error, TData> => {
    const queryKeys = createQueryKeyFactory(entityName);

    return {
        queryKey: queryKeys.detail(id),
        queryFn: () => serverFn(id),
        select: (result) => {
            if (!result.success) {
                throw new Error(result.error.message);
            }
            return result.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        retry: (failureCount, error) => {
            // Don't retry on 4xx errors
            if (error && 'status' in error && typeof error.status === 'number') {
                return error.status >= 500 && failureCount < 3;
            }
            return failureCount < 3;
        },
        ...options
    };
};

/**
 * Create query options for entity list
 */
export const createEntityListQuery = <TData>(
    entityName: string,
    params: ListQueryParams,
    serverFn: (params: ListQueryParams) => Promise<ServerFunctionResult<ListResult<TData>>>,
    options?: Partial<
        UseQueryOptions<ServerFunctionResult<ListResult<TData>>, Error, ListResult<TData>>
    >
): UseQueryOptions<ServerFunctionResult<ListResult<TData>>, Error, ListResult<TData>> => {
    const queryKeys = createQueryKeyFactory(entityName);

    return {
        queryKey: queryKeys.list(params),
        queryFn: () => serverFn(params),
        select: (result) => {
            if (!result.success) {
                throw new Error(result.error.message);
            }
            return result.data;
        },
        staleTime: 2 * 60 * 1000, // 2 minutes for lists
        gcTime: 5 * 60 * 1000, // 5 minutes
        placeholderData: (previousData) => previousData,
        ...options
    };
};

/**
 * Create mutation options for entity operations
 */
export const createEntityMutation = <TInput, TOutput>(
    entityName: string,
    operation: 'create' | 'update' | 'delete',
    serverFn: (input: TInput) => Promise<ServerFunctionResult<TOutput>>,
    options?: {
        readonly onSuccess?: (data: TOutput, variables: TInput) => void;
        readonly onError?: (error: Error, variables: TInput) => void;
        readonly optimisticUpdate?: (queryClient: QueryClient, variables: TInput) => void;
        readonly invalidateQueries?: boolean;
    }
): UseMutationOptions<ServerFunctionResult<TOutput>, Error, TInput> => {
    const queryKeys = createQueryKeyFactory(entityName);

    return {
        mutationKey: queryKeys.mutation(operation),
        mutationFn: serverFn,
        onMutate: async (variables) => {
            // Apply optimistic update if provided
            if (options?.optimisticUpdate) {
                // This will be called with queryClient in the component
                return { variables };
            }
        },
        onSuccess: (result, variables) => {
            if (!result.success) {
                throw new Error(result.error.message);
            }

            options?.onSuccess?.(result.data, variables);
        },
        onError: (error, variables) => {
            options?.onError?.(error, variables);
        },
        onSettled: () => {
            // This will be handled by the component using the mutation
            // to invalidate relevant queries
        }
    };
};

/**
 * Cache invalidation utilities
 */
export const createCacheInvalidator = (queryClient: QueryClient, entityName: string) => {
    const queryKeys = createQueryKeyFactory(entityName);

    return {
        /**
         * Invalidate all queries for this entity
         */
        invalidateAll: () => {
            return queryClient.invalidateQueries({
                queryKey: queryKeys.all
            });
        },

        /**
         * Invalidate all list queries
         */
        invalidateLists: () => {
            return queryClient.invalidateQueries({
                queryKey: queryKeys.lists()
            });
        },

        /**
         * Invalidate specific detail query
         */
        invalidateDetail: (id: string) => {
            return queryClient.invalidateQueries({
                queryKey: queryKeys.detail(id)
            });
        },

        /**
         * Invalidate all detail queries
         */
        invalidateAllDetails: () => {
            return queryClient.invalidateQueries({
                queryKey: queryKeys.details()
            });
        },

        /**
         * Remove specific query from cache
         */
        removeDetail: (id: string) => {
            return queryClient.removeQueries({
                queryKey: queryKeys.detail(id)
            });
        },

        /**
         * Set query data directly (for optimistic updates)
         */
        setDetailData: <TData>(id: string, data: TData | ((old: TData | undefined) => TData)) => {
            return queryClient.setQueryData(queryKeys.detail(id), data);
        },

        /**
         * Get cached data
         */
        getDetailData: <TData>(id: string): TData | undefined => {
            return queryClient.getQueryData<TData>(queryKeys.detail(id));
        },

        /**
         * Prefetch detail data
         */
        prefetchDetail: <TData>(
            id: string,
            serverFn: (id: string) => Promise<ServerFunctionResult<TData>>
        ) => {
            return queryClient.prefetchQuery({
                queryKey: queryKeys.detail(id),
                queryFn: () => serverFn(id),
                staleTime: 5 * 60 * 1000
            });
        }
    };
};

/**
 * Optimistic update helpers
 */
export const createOptimisticUpdates = <TData>(entityName: string) => {
    const queryKeys = createQueryKeyFactory(entityName);

    return {
        /**
         * Optimistic update for entity creation
         */
        onCreate: (queryClient: QueryClient, newItem: TData, listParams?: ListQueryParams) => {
            // Add to relevant list queries
            if (listParams) {
                queryClient.setQueryData(
                    queryKeys.list(listParams),
                    (old: ListResult<TData> | undefined) => {
                        if (!old) return old;

                        return {
                            ...old,
                            data: [newItem, ...old.data],
                            pagination: {
                                ...old.pagination,
                                total: old.pagination.total + 1
                            }
                        };
                    }
                );
            }
        },

        /**
         * Optimistic update for entity update
         */
        onUpdate: (queryClient: QueryClient, id: string, updatedData: Partial<TData>) => {
            // Update detail query
            queryClient.setQueryData(queryKeys.detail(id), (old: TData | undefined) => {
                if (!old) return old;
                return { ...old, ...updatedData };
            });

            // Update in list queries
            queryClient.setQueriesData(
                { queryKey: queryKeys.lists() },
                (old: ListResult<TData> | undefined) => {
                    if (!old) return old;

                    return {
                        ...old,
                        data: old.data.map((item) =>
                            (item as { id: string }).id === id ? { ...item, ...updatedData } : item
                        )
                    };
                }
            );
        },

        /**
         * Optimistic update for entity deletion
         */
        onDelete: (queryClient: QueryClient, id: string) => {
            // Remove from detail queries
            queryClient.removeQueries({
                queryKey: queryKeys.detail(id)
            });

            // Remove from list queries
            queryClient.setQueriesData(
                { queryKey: queryKeys.lists() },
                (old: ListResult<TData> | undefined) => {
                    if (!old) return old;

                    return {
                        ...old,
                        data: old.data.filter((item) => (item as { id: string }).id !== id),
                        pagination: {
                            ...old.pagination,
                            total: Math.max(0, old.pagination.total - 1)
                        }
                    };
                }
            );
        }
    };
};
