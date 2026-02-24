import type { EntityQueryParams, EntityQueryResponse } from '@/components/entity-list/types';
import { fetchApi } from '@/lib/api/client';
import { createEntityQueryKeys } from '@/lib/query-keys/factory';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Configuration for entity hooks factory
 */
export type EntityHooksConfig<TData, TCreate = Partial<TData>, TUpdate = Partial<TData>> = {
    /** Entity name (used for query keys) */
    readonly entityName: string;
    /** Base API endpoint */
    readonly apiEndpoint: string;
    /** Stale time in milliseconds (default: 5 minutes) */
    readonly staleTime?: number;
    /** GC time in milliseconds (default: 30 minutes) */
    readonly gcTime?: number;
    /** Transform response data */
    readonly transformResponse?: (data: unknown) => TData;
    /** Transform list response data */
    readonly transformListResponse?: (data: unknown) => EntityQueryResponse<TData>;
    /** Custom create transform */
    readonly transformCreate?: (data: TCreate) => unknown;
    /** Custom update transform */
    readonly transformUpdate?: (data: TUpdate) => unknown;
};

/**
 * Creates a complete set of hooks for entity CRUD operations
 *
 * @example
 * ```tsx
 * const accommodationHooks = createEntityHooks<Accommodation>({
 *   entityName: 'accommodations',
 *   apiEndpoint: '/api/v1/admin/accommodations'
 * });
 *
 * // In component:
 * const { useList, useDetail, useCreate, useUpdate, useDelete } = accommodationHooks;
 *
 * const { data, isLoading } = useList({ page: 1, pageSize: 20 });
 * const { data: detail } = useDetail('123');
 * const createMutation = useCreate();
 * const updateMutation = useUpdate();
 * const deleteMutation = useDelete();
 * ```
 */
export const createEntityHooks = <
    TData extends { id: string },
    TCreate = Omit<TData, 'id' | 'createdAt' | 'updatedAt'>,
    TUpdate = Partial<Omit<TData, 'id' | 'createdAt' | 'updatedAt'>>
>(
    config: EntityHooksConfig<TData, TCreate, TUpdate>
) => {
    const {
        entityName,
        apiEndpoint,
        staleTime = 5 * 60 * 1000,
        gcTime = 30 * 60 * 1000,
        transformResponse,
        transformListResponse,
        transformCreate,
        transformUpdate
    } = config;

    // Create query keys
    const queryKeys = createEntityQueryKeys(entityName);

    /**
     * Hook to fetch list of entities
     */
    const useList = (params: EntityQueryParams) => {
        return useQuery({
            queryKey: queryKeys.list(params),
            queryFn: async () => {
                const searchParams = new URLSearchParams();
                searchParams.set('page', String(params.page));
                searchParams.set('pageSize', String(params.pageSize));

                if (params.q) {
                    searchParams.set('search', params.q);
                }

                if (params.sort && params.sort.length > 0) {
                    searchParams.set('sort', JSON.stringify(params.sort));
                }

                const response = await fetchApi<unknown>({
                    path: `${apiEndpoint}?${searchParams.toString()}`
                });

                if (transformListResponse) {
                    return transformListResponse(response.data);
                }

                // Default transform for standard API response
                const apiResponse = response.data as {
                    data?: {
                        items?: TData[];
                        pagination?: {
                            page: number;
                            pageSize: number;
                            total: number;
                        };
                    };
                };

                return {
                    data: apiResponse.data?.items ?? [],
                    total: apiResponse.data?.pagination?.total ?? 0,
                    page: apiResponse.data?.pagination?.page ?? params.page,
                    pageSize: apiResponse.data?.pagination?.pageSize ?? params.pageSize
                } as EntityQueryResponse<TData>;
            },
            staleTime,
            gcTime
        });
    };

    /**
     * Hook to fetch single entity by ID
     */
    const useDetail = (id: string | undefined, options?: { enabled?: boolean }) => {
        return useQuery({
            queryKey: queryKeys.detail(id ?? ''),
            queryFn: async () => {
                if (!id) throw new Error('ID is required');

                const response = await fetchApi<unknown>({
                    path: `${apiEndpoint}/${id}`
                });

                if (transformResponse) {
                    return transformResponse(response.data);
                }

                const apiResponse = response.data as { data?: TData };
                return apiResponse.data as TData;
            },
            enabled: options?.enabled !== false && !!id,
            staleTime,
            gcTime
        });
    };

    /**
     * Hook for creating entities
     */
    const useCreate = () => {
        const queryClient = useQueryClient();

        return useMutation({
            mutationFn: async (data: TCreate) => {
                const payload = transformCreate ? transformCreate(data) : data;

                const response = await fetchApi<unknown>({
                    path: apiEndpoint,
                    method: 'POST',
                    body: payload
                });

                if (transformResponse) {
                    return transformResponse(response.data);
                }

                const apiResponse = response.data as { data?: TData };
                return apiResponse.data as TData;
            },
            onSuccess: () => {
                // Invalidate all list queries
                queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
            }
        });
    };

    /**
     * Hook for updating entities
     */
    const useUpdate = () => {
        const queryClient = useQueryClient();

        return useMutation({
            mutationFn: async ({ id, data }: { id: string; data: TUpdate }) => {
                const payload = transformUpdate ? transformUpdate(data) : data;

                const response = await fetchApi<unknown>({
                    path: `${apiEndpoint}/${id}`,
                    method: 'PUT',
                    body: payload
                });

                if (transformResponse) {
                    return transformResponse(response.data);
                }

                const apiResponse = response.data as { data?: TData };
                return apiResponse.data as TData;
            },
            onSuccess: (_, variables) => {
                // Invalidate specific detail and all lists
                queryClient.invalidateQueries({ queryKey: queryKeys.detail(variables.id) });
                queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
            }
        });
    };

    /**
     * Hook for patching entities (partial update)
     */
    const usePatch = () => {
        const queryClient = useQueryClient();

        return useMutation({
            mutationFn: async ({ id, data }: { id: string; data: Partial<TUpdate> }) => {
                const payload = transformUpdate ? transformUpdate(data as TUpdate) : data;

                const response = await fetchApi<unknown>({
                    path: `${apiEndpoint}/${id}`,
                    method: 'PATCH',
                    body: payload
                });

                if (transformResponse) {
                    return transformResponse(response.data);
                }

                const apiResponse = response.data as { data?: TData };
                return apiResponse.data as TData;
            },
            onSuccess: (_, variables) => {
                queryClient.invalidateQueries({ queryKey: queryKeys.detail(variables.id) });
                queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
            }
        });
    };

    /**
     * Hook for deleting entities
     */
    const useDelete = () => {
        const queryClient = useQueryClient();

        return useMutation({
            mutationFn: async (id: string) => {
                await fetchApi({
                    path: `${apiEndpoint}/${id}`,
                    method: 'DELETE'
                });
                return id;
            },
            onSuccess: (id) => {
                // Remove from cache and invalidate lists
                queryClient.removeQueries({ queryKey: queryKeys.detail(id) });
                queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
            }
        });
    };

    /**
     * Hook for soft deleting entities
     */
    const useSoftDelete = () => {
        const queryClient = useQueryClient();

        return useMutation({
            mutationFn: async (id: string) => {
                await fetchApi({
                    path: `${apiEndpoint}/${id}/soft-delete`,
                    method: 'POST'
                });
                return id;
            },
            onSuccess: (id) => {
                queryClient.invalidateQueries({ queryKey: queryKeys.detail(id) });
                queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
            }
        });
    };

    /**
     * Hook for restoring soft-deleted entities
     */
    const useRestore = () => {
        const queryClient = useQueryClient();

        return useMutation({
            mutationFn: async (id: string) => {
                await fetchApi({
                    path: `${apiEndpoint}/${id}/restore`,
                    method: 'POST'
                });
                return id;
            },
            onSuccess: (id) => {
                queryClient.invalidateQueries({ queryKey: queryKeys.detail(id) });
                queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
            }
        });
    };

    /**
     * Combined hook that returns all hooks and utilities
     */
    const useEntityOperations = () => {
        const listHooks = {
            useList
        };

        const detailHooks = {
            useDetail
        };

        const mutationHooks = {
            useCreate: useCreate(),
            useUpdate: useUpdate(),
            usePatch: usePatch(),
            useDelete: useDelete(),
            useSoftDelete: useSoftDelete(),
            useRestore: useRestore()
        };

        const queryClient = useQueryClient();

        const invalidateAll = useCallback(() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.all });
        }, [queryClient]);

        const invalidateLists = useCallback(() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
        }, [queryClient]);

        const invalidateDetail = useCallback(
            (id: string) => {
                queryClient.invalidateQueries({ queryKey: queryKeys.detail(id) });
            },
            [queryClient]
        );

        return {
            ...listHooks,
            ...detailHooks,
            ...mutationHooks,
            queryKeys,
            invalidateAll,
            invalidateLists,
            invalidateDetail
        };
    };

    return {
        // Individual hooks
        useList,
        useDetail,
        useCreate,
        useUpdate,
        usePatch,
        useDelete,
        useSoftDelete,
        useRestore,

        // Combined hook
        useEntityOperations,

        // Query keys for external use
        queryKeys,

        // Config for reference
        config: {
            entityName,
            apiEndpoint
        }
    };
};

/**
 * Type helper to extract hooks from factory result
 */
export type EntityHooks<TData extends { id: string }> = ReturnType<typeof createEntityHooks<TData>>;
