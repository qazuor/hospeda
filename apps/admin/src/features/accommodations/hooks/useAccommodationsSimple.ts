/**
 * @file Simple Accommodations Hooks
 *
 * Simplified hooks that work directly with TanStack Query and server functions
 * without complex abstractions.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type {
    Accommodation,
    CreateAccommodationData,
    UpdateAccommodationData
} from '../server/accommodations-server.config';
import {
    createAccommodationSimple,
    deleteAccommodationSimple,
    getAccommodationSimple,
    listAccommodationsSimple,
    updateAccommodationSimple
} from '../server/accommodations-simple-functions';

/**
 * Type for server function results
 */
type ServerResult<T = Record<string, unknown>> =
    | { success: true; data: T; meta?: Record<string, unknown> }
    | { success: false; error: { code: string; message: string } };

/**
 * Query key factory for accommodations
 */
export const accommodationKeys = {
    all: ['accommodations'] as const,
    lists: () => [...accommodationKeys.all, 'list'] as const,
    list: (params: Record<string, unknown>) => [...accommodationKeys.lists(), params] as const,
    details: () => [...accommodationKeys.all, 'detail'] as const,
    detail: (id: string) => [...accommodationKeys.details(), id] as const
};

/**
 * Hook for fetching accommodation details
 */
export const useAccommodationDetailSimple = (
    id: string,
    options?: {
        readonly enabled?: boolean;
        readonly staleTime?: number;
        readonly gcTime?: number;
    }
) => {
    const query = useQuery({
        queryKey: accommodationKeys.detail(id),
        queryFn: async () => {
            const result = (await getAccommodationSimple({ data: { id } })) as ServerResult<
                Record<string, unknown>
            >;
            if (result && !result.success) {
                throw new Error(result.error?.message || 'Failed to fetch accommodation');
            }
            return result?.data || {};
        },
        enabled: options?.enabled !== false && !!id,
        staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
        gcTime: options?.gcTime ?? 10 * 60 * 1000, // 10 minutes
        retry: (failureCount, error) => {
            // Don't retry on 4xx errors
            if (error && 'status' in error && typeof error.status === 'number') {
                return error.status >= 500 && failureCount < 3;
            }
            return failureCount < 3;
        }
    });

    const queryClient = useQueryClient();

    const invalidate = useCallback(async () => {
        await queryClient.invalidateQueries({
            queryKey: accommodationKeys.detail(id)
        });
    }, [queryClient, id]);

    const prefetch = useCallback(async () => {
        await queryClient.prefetchQuery({
            queryKey: accommodationKeys.detail(id),
            queryFn: async () => {
                const result = await getAccommodationSimple({ data: { id } });
                const anyResult = result as ServerResult<Record<string, unknown>>;
                if (anyResult && !anyResult.success) {
                    throw new Error(anyResult.error?.message || 'Failed to fetch accommodation');
                }
                return anyResult?.data || ({} as Record<string, unknown>);
            },
            staleTime: 5 * 60 * 1000
        });
    }, [queryClient, id]);

    return {
        ...query,
        invalidate,
        prefetch
    };
};

/**
 * Hook for fetching accommodations list
 */
export const useAccommodationsListSimple = (
    params: {
        readonly page?: number;
        readonly limit?: number;
        readonly sort?: string;
        readonly order?: 'asc' | 'desc';
        readonly search?: string;
        readonly filters?: Record<string, unknown>;
    } = {},
    options?: {
        readonly enabled?: boolean;
        readonly staleTime?: number;
        readonly gcTime?: number;
        readonly keepPreviousData?: boolean;
    }
) => {
    const query = useQuery({
        queryKey: accommodationKeys.list(params),
        queryFn: async () => {
            const result = await listAccommodationsSimple({ data: params });
            const anyResult = result as ServerResult;
            if (anyResult && !anyResult.success) {
                throw new Error(anyResult.error?.message || 'Operation failed');
            }
            return anyResult?.data || ({} as Record<string, unknown>);
        },
        enabled: options?.enabled !== false,
        staleTime: options?.staleTime ?? 2 * 60 * 1000, // 2 minutes
        gcTime: options?.gcTime ?? 5 * 60 * 1000, // 5 minutes
        placeholderData: options?.keepPreviousData ? (previousData) => previousData : undefined
    });

    const queryClient = useQueryClient();

    const invalidate = useCallback(async () => {
        await queryClient.invalidateQueries({
            queryKey: accommodationKeys.list(params)
        });
    }, [queryClient, params]);

    const invalidateAll = useCallback(async () => {
        await queryClient.invalidateQueries({
            queryKey: accommodationKeys.lists()
        });
    }, [queryClient]);

    return {
        ...query,
        invalidate,
        invalidateAll
    };
};

/**
 * Hook for creating accommodations
 */
export const useCreateAccommodationSimple = (options?: {
    readonly onSuccess?: (data: Accommodation, variables: CreateAccommodationData) => void;
    readonly onError?: (error: Error, variables: CreateAccommodationData) => void;
    readonly optimistic?: boolean;
    readonly invalidateQueries?: boolean;
}) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ['accommodations', 'create'],
        mutationFn: async (data: CreateAccommodationData) => {
            const result = await createAccommodationSimple({ data: { data } });
            const anyResult = result as ServerResult;
            if (anyResult && !anyResult.success) {
                throw new Error(anyResult.error?.message || 'Operation failed');
            }
            return anyResult?.data || ({} as Record<string, unknown>);
        },
        onMutate: async () => {
            if (options?.optimistic) {
                // Cancel outgoing refetches
                await queryClient.cancelQueries({ queryKey: accommodationKeys.all });

                // Snapshot the previous value
                const previousData = queryClient.getQueriesData({
                    queryKey: accommodationKeys.all
                });

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
        onSuccess: (data, variables) => {
            options?.onSuccess?.(data as Accommodation, variables);

            // Invalidate relevant queries
            if (options?.invalidateQueries !== false) {
                void queryClient.invalidateQueries({
                    queryKey: accommodationKeys.lists()
                });
            }
        }
    });
};

/**
 * Hook for updating accommodations
 */
export const useUpdateAccommodationSimple = (options?: {
    readonly onSuccess?: (
        data: Accommodation,
        variables: { id: string; data: UpdateAccommodationData }
    ) => void;
    readonly onError?: (
        error: Error,
        variables: { id: string; data: UpdateAccommodationData }
    ) => void;
    readonly optimistic?: boolean;
    readonly invalidateQueries?: boolean;
}) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ['accommodations', 'update'],
        mutationFn: async ({ id, data }: { id: string; data: UpdateAccommodationData }) => {
            const result = await updateAccommodationSimple({ data: { id, data } });
            const anyResult = result as ServerResult;
            if (anyResult && !anyResult.success) {
                throw new Error(anyResult.error?.message || 'Operation failed');
            }
            return anyResult?.data || ({} as Record<string, unknown>);
        },
        onMutate: async (variables) => {
            if (options?.optimistic) {
                // Cancel outgoing refetches
                await queryClient.cancelQueries({ queryKey: accommodationKeys.all });

                // Snapshot the previous value
                const previousData = queryClient.getQueriesData({
                    queryKey: accommodationKeys.all
                });

                // Apply optimistic update
                queryClient.setQueryData(
                    accommodationKeys.detail(variables.id),
                    (old: Accommodation | undefined) => {
                        if (!old) return old;
                        return { ...old, ...variables.data };
                    }
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
        onSuccess: (data, variables) => {
            options?.onSuccess?.(data as Accommodation, variables);

            // Update cache with server response
            queryClient.setQueryData(accommodationKeys.detail(variables.id), data);

            // Invalidate relevant queries
            if (options?.invalidateQueries !== false) {
                void queryClient.invalidateQueries({
                    queryKey: accommodationKeys.lists()
                });
            }
        }
    });
};

/**
 * Hook for deleting accommodations
 */
export const useDeleteAccommodationSimple = (options?: {
    readonly onSuccess?: (data: { id: string }, variables: { id: string }) => void;
    readonly onError?: (error: Error, variables: { id: string }) => void;
    readonly optimistic?: boolean;
    readonly invalidateQueries?: boolean;
}) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ['accommodations', 'delete'],
        mutationFn: async ({ id }: { id: string }) => {
            const result = await deleteAccommodationSimple({ data: { id } });
            const anyResult = result as ServerResult;
            if (anyResult && !anyResult.success) {
                throw new Error(anyResult.error?.message || 'Operation failed');
            }
            return anyResult?.data || ({} as Record<string, unknown>);
        },
        onMutate: async (variables) => {
            if (options?.optimistic) {
                // Cancel outgoing refetches
                await queryClient.cancelQueries({ queryKey: accommodationKeys.all });

                // Snapshot the previous value
                const previousData = queryClient.getQueriesData({
                    queryKey: accommodationKeys.all
                });

                // Apply optimistic delete
                queryClient.removeQueries({
                    queryKey: accommodationKeys.detail(variables.id)
                });

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
        onSuccess: (data, variables) => {
            options?.onSuccess?.(data as { id: string }, variables);

            // Ensure the item is removed from cache
            queryClient.removeQueries({
                queryKey: accommodationKeys.detail(variables.id)
            });

            // Invalidate relevant queries
            if (options?.invalidateQueries !== false) {
                void queryClient.invalidateQueries({
                    queryKey: accommodationKeys.lists()
                });
            }
        }
    });
};

/**
 * Hook for accommodations cache management
 */
export const useAccommodationsCacheSimple = () => {
    const queryClient = useQueryClient();

    return {
        invalidateAll: useCallback(() => {
            return queryClient.invalidateQueries({
                queryKey: accommodationKeys.all
            });
        }, [queryClient]),

        invalidateLists: useCallback(() => {
            return queryClient.invalidateQueries({
                queryKey: accommodationKeys.lists()
            });
        }, [queryClient]),

        invalidateDetail: useCallback(
            (id: string) => {
                return queryClient.invalidateQueries({
                    queryKey: accommodationKeys.detail(id)
                });
            },
            [queryClient]
        ),

        removeDetail: useCallback(
            (id: string) => {
                return queryClient.removeQueries({
                    queryKey: accommodationKeys.detail(id)
                });
            },
            [queryClient]
        ),

        setDetailData: useCallback(
            <TData>(id: string, data: TData | ((_old: TData | undefined) => TData)) => {
                return queryClient.setQueryData(accommodationKeys.detail(id), data);
            },
            [queryClient]
        ),

        getDetailData: useCallback(
            <TData>(id: string): TData | undefined => {
                return queryClient.getQueryData<TData>(accommodationKeys.detail(id));
            },
            [queryClient]
        ),

        prefetchDetail: useCallback(
            async (id: string) => {
                return queryClient.prefetchQuery({
                    queryKey: accommodationKeys.detail(id),
                    queryFn: async () => {
                        const result = await getAccommodationSimple({ data: { id } });
                        const anyResult = result as ServerResult<Record<string, unknown>>;
                        if (anyResult && !anyResult.success) {
                            throw new Error(
                                anyResult.error?.message || 'Failed to fetch accommodation'
                            );
                        }
                        return anyResult?.data || ({} as Record<string, unknown>);
                    },
                    staleTime: 5 * 60 * 1000
                });
            },
            [queryClient]
        )
    };
};
