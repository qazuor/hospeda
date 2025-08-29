/**
 * @file Server Function Hooks
 *
 * This file provides React hooks that integrate server functions with TanStack Query
 * for optimal data fetching, caching, and mutations with full TypeScript support.
 */

import { type UseQueryResult, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
    createCacheInvalidator,
    createEntityDetailQuery,
    createEntityListQuery,
    createEntityMutation,
    createOptimisticUpdates
} from './query-integration';
import type {
    EntityServerConfig,
    ListQueryParams,
    ListResult,
    ServerFunctionResult
} from './types';

/**
 * Hook for fetching entity details with caching and error handling
 */
export const useEntityDetail = <TData, TCreateData, TUpdateData>(
    config: EntityServerConfig<TData, TCreateData, TUpdateData>,
    id: string,
    serverFn: (data: { id: string }) => Promise<ServerFunctionResult<TData>>,
    options?: {
        readonly enabled?: boolean;
        readonly staleTime?: number;
        readonly gcTime?: number;
    }
): UseQueryResult<TData, Error> & {
    readonly invalidate: () => Promise<void>;
    readonly prefetch: () => Promise<void>;
} => {
    const queryClient = useQueryClient();
    const invalidator = createCacheInvalidator(queryClient, config.name);

    const query = useQuery(
        createEntityDetailQuery(config.name, id, (entityId) => serverFn({ id: entityId }), {
            enabled: options?.enabled !== false && !!id,
            staleTime: options?.staleTime,
            gcTime: options?.gcTime
        })
    );

    const invalidate = useCallback(async () => {
        await invalidator.invalidateDetail(id);
    }, [invalidator, id]);

    const prefetch = useCallback(async () => {
        await invalidator.prefetchDetail(id, (entityId) => serverFn({ id: entityId }));
    }, [invalidator, id, serverFn]);

    return {
        ...query,
        invalidate,
        prefetch
    };
};

/**
 * Hook for fetching entity lists with pagination and filtering
 */
export const useEntityList = <TData, TCreateData, TUpdateData>(
    config: EntityServerConfig<TData, TCreateData, TUpdateData>,
    params: ListQueryParams,
    serverFn: (params: ListQueryParams) => Promise<ServerFunctionResult<ListResult<TData>>>,
    options?: {
        readonly enabled?: boolean;
        readonly staleTime?: number;
        readonly gcTime?: number;
        readonly keepPreviousData?: boolean;
    }
): UseQueryResult<ListResult<TData>, Error> & {
    readonly invalidate: () => Promise<void>;
    readonly invalidateAll: () => Promise<void>;
} => {
    const queryClient = useQueryClient();
    const invalidator = createCacheInvalidator(queryClient, config.name);

    const query = useQuery(
        createEntityListQuery(config.name, params, serverFn, {
            enabled: options?.enabled !== false,
            staleTime: options?.staleTime,
            gcTime: options?.gcTime,
            placeholderData: options?.keepPreviousData ? (previousData) => previousData : undefined
        })
    );

    const invalidate = useCallback(async () => {
        await queryClient.invalidateQueries({
            queryKey: [config.name, 'list', params]
        });
    }, [queryClient, config.name, params]);

    const invalidateAll = useCallback(async () => {
        await invalidator.invalidateLists();
    }, [invalidator]);

    return {
        ...query,
        invalidate,
        invalidateAll
    };
};

/**
 * Hook for creating entities with optimistic updates
 */
export const useCreateEntity = <TData, TCreateData, TUpdateData>(
    config: EntityServerConfig<TData, TCreateData, TUpdateData>,
    serverFn: (data: { data: TCreateData }) => Promise<ServerFunctionResult<TData>>,
    options?: {
        readonly onSuccess?: (data: TData, variables: TCreateData) => void;
        readonly onError?: (error: Error, variables: TCreateData) => void;
        readonly optimistic?: boolean;
        readonly invalidateQueries?: boolean;
    }
) => {
    const queryClient = useQueryClient();
    const invalidator = createCacheInvalidator(queryClient, config.name);
    // const optimisticUpdates = createOptimisticUpdates<TData>(config.name);

    return useMutation({
        ...createEntityMutation(
            config.name,
            'create',
            (input: TCreateData) => serverFn({ data: input }),
            {
                onSuccess: options?.onSuccess,
                onError: options?.onError,
                optimisticUpdate: options?.optimistic
                    ? () => {
                          // Apply optimistic update for creation
                          // This would need the new item structure, which we don't have yet
                          // So we'll handle this in the onMutate callback
                      }
                    : undefined
            }
        ),
        onMutate: async () => {
            if (options?.optimistic) {
                // Cancel outgoing refetches
                await queryClient.cancelQueries({ queryKey: [config.name] });

                // Snapshot the previous value
                const previousData = queryClient.getQueriesData({ queryKey: [config.name] });

                // We can't do optimistic create without knowing the ID
                // This would be handled after the server responds

                return { previousData };
            }
        },
        onError: (error, variables, context) => {
            // Rollback optimistic updates
            if (context?.previousData && options?.optimistic) {
                for (const [queryKey, data] of context.previousData) {
                    queryClient.setQueryData(queryKey, data);
                }
            }

            options?.onError?.(error, variables);
        },
        onSuccess: (result, variables) => {
            if (result.success) {
                options?.onSuccess?.(result.data, variables);

                // Invalidate relevant queries
                if (options?.invalidateQueries !== false) {
                    void invalidator.invalidateLists();
                }
            }
        }
    });
};

/**
 * Hook for updating entities with optimistic updates
 */
export const useUpdateEntity = <TData, TCreateData, TUpdateData>(
    config: EntityServerConfig<TData, TCreateData, TUpdateData>,
    serverFn: (data: { id: string; data: TUpdateData }) => Promise<ServerFunctionResult<TData>>,
    options?: {
        readonly onSuccess?: (data: TData, variables: { id: string; data: TUpdateData }) => void;
        readonly onError?: (error: Error, variables: { id: string; data: TUpdateData }) => void;
        readonly optimistic?: boolean;
        readonly invalidateQueries?: boolean;
    }
) => {
    const queryClient = useQueryClient();
    const invalidator = createCacheInvalidator(queryClient, config.name);
    const optimisticUpdates = createOptimisticUpdates<TData>(config.name);

    return useMutation({
        ...createEntityMutation(config.name, 'update', serverFn),
        onMutate: async (variables) => {
            if (options?.optimistic) {
                // Cancel outgoing refetches
                await queryClient.cancelQueries({ queryKey: [config.name] });

                // Snapshot the previous value
                const previousData = queryClient.getQueriesData({ queryKey: [config.name] });

                // Apply optimistic update
                optimisticUpdates.onUpdate(
                    queryClient,
                    variables.id,
                    variables.data as Partial<TData>
                );

                return { previousData };
            }
        },
        onError: (error, variables, context) => {
            // Rollback optimistic updates
            if (context?.previousData && options?.optimistic) {
                for (const [queryKey, data] of context.previousData) {
                    queryClient.setQueryData(queryKey, data);
                }
            }

            options?.onError?.(error, variables);
        },
        onSuccess: (result, variables) => {
            if (result.success) {
                options?.onSuccess?.(result.data, variables);

                // Update cache with server response
                invalidator.setDetailData(variables.id, result.data);

                // Invalidate relevant queries
                if (options?.invalidateQueries !== false) {
                    void invalidator.invalidateLists();
                }
            }
        }
    });
};

/**
 * Hook for deleting entities with optimistic updates
 */
export const useDeleteEntity = <TData, TCreateData, TUpdateData>(
    config: EntityServerConfig<TData, TCreateData, TUpdateData>,
    serverFn: (data: { id: string }) => Promise<ServerFunctionResult<{ id: string }>>,
    options?: {
        readonly onSuccess?: (data: { id: string }, variables: { id: string }) => void;
        readonly onError?: (error: Error, variables: { id: string }) => void;
        readonly optimistic?: boolean;
        readonly invalidateQueries?: boolean;
    }
) => {
    const queryClient = useQueryClient();
    const invalidator = createCacheInvalidator(queryClient, config.name);
    const optimisticUpdates = createOptimisticUpdates<TData>(config.name);

    return useMutation({
        ...createEntityMutation(config.name, 'delete', serverFn),
        onMutate: async (variables) => {
            if (options?.optimistic) {
                // Cancel outgoing refetches
                await queryClient.cancelQueries({ queryKey: [config.name] });

                // Snapshot the previous value
                const previousData = queryClient.getQueriesData({ queryKey: [config.name] });

                // Apply optimistic delete
                optimisticUpdates.onDelete(queryClient, variables.id);

                return { previousData };
            }
        },
        onError: (error, variables, context) => {
            // Rollback optimistic updates
            if (context?.previousData && options?.optimistic) {
                for (const [queryKey, data] of context.previousData) {
                    queryClient.setQueryData(queryKey, data);
                }
            }

            options?.onError?.(error, variables);
        },
        onSuccess: (result, variables) => {
            if (result.success) {
                options?.onSuccess?.(result.data, variables);

                // Ensure the item is removed from cache
                invalidator.removeDetail(variables.id);

                // Invalidate relevant queries
                if (options?.invalidateQueries !== false) {
                    void invalidator.invalidateLists();
                }
            }
        }
    });
};

/**
 * Hook for cache management utilities
 */
export const useEntityCache = <TData, TCreateData, TUpdateData>(
    config: EntityServerConfig<TData, TCreateData, TUpdateData>
) => {
    const queryClient = useQueryClient();
    const invalidator = createCacheInvalidator(queryClient, config.name);

    return {
        invalidateAll: invalidator.invalidateAll,
        invalidateLists: invalidator.invalidateLists,
        invalidateDetail: invalidator.invalidateDetail,
        invalidateAllDetails: invalidator.invalidateAllDetails,
        removeDetail: invalidator.removeDetail,
        setDetailData: invalidator.setDetailData,
        getDetailData: invalidator.getDetailData,
        prefetchDetail: invalidator.prefetchDetail
    };
};
