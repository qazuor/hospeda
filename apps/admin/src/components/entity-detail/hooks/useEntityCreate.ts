import { fetchApi } from '@/lib/api/client';
import { useEntityQueryKeys } from '@/lib/query-keys/hooks/useEntityQueryKeys';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import type { EntityDetailConfig } from '../types';

type UseEntityCreateProps<TData, TCreateData> = {
    readonly config: EntityDetailConfig<TData, TCreateData>;
    readonly onSuccess?: (data: TData) => void;
    readonly onError?: (error: Error) => void;
};

/**
 * Hook to handle entity creation operations with optimistic updates
 * Provides instant feedback by optimistically adding the new entity to lists
 */
export const useEntityCreate = <TData, TCreateData>({
    config,
    onSuccess,
    onError
}: UseEntityCreateProps<TData, TCreateData>) => {
    const router = useRouter();
    const { queryKeys, invalidateLists, getListData, setListData } = useEntityQueryKeys(
        config.name
    );

    const createMutation = useMutation({
        mutationFn: async (data: TCreateData): Promise<TData> => {
            // Validate data with create schema (assuming we have one)
            const validatedData = config.editSchema.parse(data);

            if (!config.createEndpoint) {
                throw new Error('Create operation not supported');
            }

            const { data: result } = await fetchApi<TData>({
                path: config.createEndpoint,
                method: 'POST',
                body: validatedData
            });

            return config.detailSchema.parse(result);
        },
        onMutate: async (newData: TCreateData) => {
            // Generate a temporary ID for optimistic update
            const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Create optimistic entity with temporary data
            const optimisticEntity = {
                id: tempId,
                ...newData,
                // Add common fields that are usually set by the server
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                // Mark as optimistic for potential styling/handling
                _isOptimistic: true
            } as unknown as TData & { _isOptimistic?: boolean };

            // Get current list data for all possible list queries
            const listSnapshots: Array<{
                queryKey: readonly unknown[];
                previousData: unknown;
            }> = [];

            // We need to update all list queries that might include this new entity
            // For now, we'll focus on the basic list without filters
            const basicListKey = queryKeys.list({ page: 1, pageSize: 10 });
            const currentListData = getListData(basicListKey);

            if (currentListData) {
                listSnapshots.push({
                    queryKey: basicListKey,
                    previousData: currentListData
                });

                // Optimistically add the new entity to the beginning of the list
                setListData(basicListKey, (old) => {
                    if (!old) return old;

                    // Assuming the list data has a structure like { data: TData[], ... }
                    if (typeof old === 'object' && old !== null && 'data' in old) {
                        const listData = old as { data: TData[]; [key: string]: unknown };
                        return {
                            ...listData,
                            data: [optimisticEntity, ...listData.data],
                            // Update total count if present
                            ...('total' in listData && { total: (listData.total as number) + 1 })
                        };
                    }

                    return old;
                });
            }

            // Return context for rollback
            return {
                tempId,
                listSnapshots,
                optimisticEntity
            };
        },
        onSuccess: (data, _variables, context) => {
            // Remove the optimistic entity and add the real one
            if (context?.tempId) {
                // Update all affected list queries
                for (const { queryKey } of context.listSnapshots) {
                    setListData(queryKey, (old) => {
                        if (!old) return old;

                        if (typeof old === 'object' && old !== null && 'data' in old) {
                            const listData = old as {
                                data: (TData & { _isOptimistic?: boolean })[];
                                [key: string]: unknown;
                            };
                            return {
                                ...listData,
                                data: listData.data.map((item) =>
                                    (item as unknown as { id: string }).id === context.tempId
                                        ? { ...data, _isOptimistic: false } // Replace with real data
                                        : item
                                )
                            };
                        }

                        return old;
                    });
                }
            }

            // Invalidate queries to ensure consistency
            invalidateLists();

            // Call success callback
            onSuccess?.(data);

            // Navigate to the new entity's detail page
            if (config.viewPath && data && typeof data === 'object' && 'id' in data) {
                router.navigate({
                    to: config.viewPath,
                    params: { id: String(data.id) }
                });
            }
        },
        onError: (error, _variables, context) => {
            // Rollback optimistic updates
            if (context?.listSnapshots) {
                for (const { queryKey, previousData } of context.listSnapshots) {
                    setListData(queryKey, previousData);
                }
            }

            // Call error callback
            onError?.(error);

            // Log the error for debugging
            console.error('Create error:', error);
        },
        onSettled: () => {
            // Always invalidate lists to ensure consistency
            invalidateLists();
        }
    });

    return {
        create: createMutation.mutate,
        createAsync: createMutation.mutateAsync,
        isCreating: createMutation.isPending,
        createError: createMutation.error,
        reset: createMutation.reset
    };
};
