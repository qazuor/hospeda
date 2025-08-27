import { fetchApi } from '@/lib/api/client';
import { useEntityQueryKeys } from '@/lib/query-keys/hooks/useEntityQueryKeys';
import { useMutation } from '@tanstack/react-query';

type UseEntityListMutationsProps<TData> = {
    readonly entityName: string;
    readonly updateEndpoint?: string; // PUT /api/v1/admin/accommodations/:id
    readonly deleteEndpoint?: string; // DELETE /api/v1/admin/accommodations/:id
    readonly bulkUpdateEndpoint?: string; // PUT /api/v1/admin/accommodations/bulk
    readonly bulkDeleteEndpoint?: string; // DELETE /api/v1/admin/accommodations/bulk
    readonly onSuccess?: (operation: string, data?: TData | TData[]) => void;
    readonly onError?: (operation: string, error: Error) => void;
};

/**
 * Hook to handle entity list mutations with optimistic updates
 * Provides instant feedback for operations performed on list items
 */
export const useEntityListMutations = <TData extends { id: string }>({
    entityName,
    updateEndpoint,
    deleteEndpoint,
    bulkUpdateEndpoint,
    bulkDeleteEndpoint,
    onSuccess,
    onError
}: UseEntityListMutationsProps<TData>) => {
    const { queryKeys, invalidateDetail, invalidateLists, getListData, setListData } =
        useEntityQueryKeys(entityName);

    /**
     * Update a single entity in the list with optimistic updates
     */
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<TData> }): Promise<TData> => {
            if (!updateEndpoint) {
                throw new Error('Update operation not supported');
            }

            const { data: result } = await fetchApi<TData>({
                path: updateEndpoint.replace(':id', id),
                method: 'PUT',
                body: data
            });

            return result;
        },
        onMutate: async ({ id, data }) => {
            // Get all current list queries and update them optimistically
            const listSnapshots: Array<{
                queryKey: readonly unknown[];
                previousData: unknown;
            }> = [];

            // We need to find all list queries that might contain this entity
            // For now, we'll update the basic list query
            const basicListKey = queryKeys.list({ page: 1, pageSize: 10 });
            const currentListData = getListData(basicListKey);

            if (currentListData) {
                listSnapshots.push({
                    queryKey: basicListKey,
                    previousData: currentListData
                });

                // Optimistically update the entity in the list
                setListData(basicListKey, (old) => {
                    if (!old) return old;

                    if (typeof old === 'object' && old !== null && 'data' in old) {
                        const listData = old as { data: TData[]; [key: string]: unknown };
                        return {
                            ...listData,
                            data: listData.data.map((item) =>
                                item.id === id
                                    ? ({ ...item, ...data, _isOptimistic: true } as TData & {
                                          _isOptimistic?: boolean;
                                      })
                                    : item
                            )
                        };
                    }

                    return old;
                });
            }

            return { id, listSnapshots };
        },
        onSuccess: (result, variables, context) => {
            // Replace optimistic data with real data
            if (context?.listSnapshots) {
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
                                    item.id === variables.id
                                        ? { ...result, _isOptimistic: false }
                                        : item
                                )
                            };
                        }

                        return old;
                    });
                }
            }

            // Invalidate detail query for this specific entity
            invalidateDetail(variables.id);

            onSuccess?.('update', result);
        },
        onError: (error, _variables, context) => {
            // Rollback optimistic updates
            if (context?.listSnapshots) {
                for (const { queryKey, previousData } of context.listSnapshots) {
                    setListData(queryKey, previousData);
                }
            }

            onError?.('update', error);
        }
    });

    /**
     * Delete a single entity from the list with optimistic updates
     */
    const deleteMutation = useMutation({
        mutationFn: async (id: string): Promise<void> => {
            if (!deleteEndpoint) {
                throw new Error('Delete operation not supported');
            }

            await fetchApi<void>({
                path: deleteEndpoint.replace(':id', id),
                method: 'DELETE'
            });
        },
        onMutate: async (id) => {
            // Get all current list queries and update them optimistically
            const listSnapshots: Array<{
                queryKey: readonly unknown[];
                previousData: unknown;
            }> = [];

            const basicListKey = queryKeys.list({ page: 1, pageSize: 10 });
            const currentListData = getListData(basicListKey);

            if (currentListData) {
                listSnapshots.push({
                    queryKey: basicListKey,
                    previousData: currentListData
                });

                // Optimistically remove the entity from the list
                setListData(basicListKey, (old) => {
                    if (!old) return old;

                    if (typeof old === 'object' && old !== null && 'data' in old) {
                        const listData = old as {
                            data: TData[];
                            total?: number;
                            [key: string]: unknown;
                        };
                        return {
                            ...listData,
                            data: listData.data.filter((item) => item.id !== id),
                            // Update total count if present
                            ...('total' in listData && { total: (listData.total as number) - 1 })
                        };
                    }

                    return old;
                });
            }

            return { id, listSnapshots };
        },
        onSuccess: (_result, _id, _context) => {
            // The optimistic update is already correct, just invalidate to ensure consistency
            invalidateLists();

            onSuccess?.('delete');
        },
        onError: (error, _id, context) => {
            // Rollback optimistic updates
            if (context?.listSnapshots) {
                for (const { queryKey, previousData } of context.listSnapshots) {
                    setListData(queryKey, previousData);
                }
            }

            onError?.('delete', error);
        }
    });

    /**
     * Bulk update multiple entities with optimistic updates
     */
    const bulkUpdateMutation = useMutation({
        mutationFn: async ({
            ids,
            data
        }: { ids: string[]; data: Partial<TData> }): Promise<TData[]> => {
            if (!bulkUpdateEndpoint) {
                throw new Error('Bulk update operation not supported');
            }

            const { data: result } = await fetchApi<TData[]>({
                path: bulkUpdateEndpoint,
                method: 'PUT',
                body: { ids, data }
            });

            return result;
        },
        onMutate: async ({ ids, data }) => {
            const listSnapshots: Array<{
                queryKey: readonly unknown[];
                previousData: unknown;
            }> = [];

            const basicListKey = queryKeys.list({ page: 1, pageSize: 10 });
            const currentListData = getListData(basicListKey);

            if (currentListData) {
                listSnapshots.push({
                    queryKey: basicListKey,
                    previousData: currentListData
                });

                // Optimistically update multiple entities in the list
                setListData(basicListKey, (old) => {
                    if (!old) return old;

                    if (typeof old === 'object' && old !== null && 'data' in old) {
                        const listData = old as { data: TData[]; [key: string]: unknown };
                        return {
                            ...listData,
                            data: listData.data.map((item) =>
                                ids.includes(item.id)
                                    ? ({ ...item, ...data, _isOptimistic: true } as TData & {
                                          _isOptimistic?: boolean;
                                      })
                                    : item
                            )
                        };
                    }

                    return old;
                });
            }

            return { ids, listSnapshots };
        },
        onSuccess: (result, variables, context) => {
            // Replace optimistic data with real data
            if (context?.listSnapshots) {
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
                                data: listData.data.map((item) => {
                                    const updatedItem = result.find((r) => r.id === item.id);
                                    return updatedItem
                                        ? { ...updatedItem, _isOptimistic: false }
                                        : item;
                                })
                            };
                        }

                        return old;
                    });
                }
            }

            // Invalidate detail queries for all updated entities
            for (const id of variables.ids) {
                invalidateDetail(id);
            }

            onSuccess?.('bulkUpdate', result);
        },
        onError: (error, _variables, context) => {
            // Rollback optimistic updates
            if (context?.listSnapshots) {
                for (const { queryKey, previousData } of context.listSnapshots) {
                    setListData(queryKey, previousData);
                }
            }

            onError?.('bulkUpdate', error);
        }
    });

    /**
     * Bulk delete multiple entities with optimistic updates
     */
    const bulkDeleteMutation = useMutation({
        mutationFn: async (ids: string[]): Promise<void> => {
            if (!bulkDeleteEndpoint) {
                throw new Error('Bulk delete operation not supported');
            }

            await fetchApi<void>({
                path: bulkDeleteEndpoint,
                method: 'DELETE',
                body: { ids }
            });
        },
        onMutate: async (ids) => {
            const listSnapshots: Array<{
                queryKey: readonly unknown[];
                previousData: unknown;
            }> = [];

            const basicListKey = queryKeys.list({ page: 1, pageSize: 10 });
            const currentListData = getListData(basicListKey);

            if (currentListData) {
                listSnapshots.push({
                    queryKey: basicListKey,
                    previousData: currentListData
                });

                // Optimistically remove multiple entities from the list
                setListData(basicListKey, (old) => {
                    if (!old) return old;

                    if (typeof old === 'object' && old !== null && 'data' in old) {
                        const listData = old as {
                            data: TData[];
                            total?: number;
                            [key: string]: unknown;
                        };
                        const filteredData = listData.data.filter((item) => !ids.includes(item.id));
                        return {
                            ...listData,
                            data: filteredData,
                            // Update total count if present
                            ...('total' in listData && {
                                total: (listData.total as number) - ids.length
                            })
                        };
                    }

                    return old;
                });
            }

            return { ids, listSnapshots };
        },
        onSuccess: (_result, _ids, _context) => {
            // The optimistic update is already correct, just invalidate to ensure consistency
            invalidateLists();

            onSuccess?.('bulkDelete');
        },
        onError: (error, _ids, context) => {
            // Rollback optimistic updates
            if (context?.listSnapshots) {
                for (const { queryKey, previousData } of context.listSnapshots) {
                    setListData(queryKey, previousData);
                }
            }

            onError?.('bulkDelete', error);
        }
    });

    return {
        // Single operations
        updateEntity: updateMutation.mutate,
        deleteEntity: deleteMutation.mutate,

        // Bulk operations
        bulkUpdateEntities: bulkUpdateMutation.mutate,
        bulkDeleteEntities: bulkDeleteMutation.mutate,

        // Async versions
        updateEntityAsync: updateMutation.mutateAsync,
        deleteEntityAsync: deleteMutation.mutateAsync,
        bulkUpdateEntitiesAsync: bulkUpdateMutation.mutateAsync,
        bulkDeleteEntitiesAsync: bulkDeleteMutation.mutateAsync,

        // Status
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
        isBulkUpdating: bulkUpdateMutation.isPending,
        isBulkDeleting: bulkDeleteMutation.isPending,

        // Errors
        updateError: updateMutation.error,
        deleteError: deleteMutation.error,
        bulkUpdateError: bulkUpdateMutation.error,
        bulkDeleteError: bulkDeleteMutation.error,

        // Reset functions
        resetUpdate: updateMutation.reset,
        resetDelete: deleteMutation.reset,
        resetBulkUpdate: bulkUpdateMutation.reset,
        resetBulkDelete: bulkDeleteMutation.reset
    };
};
