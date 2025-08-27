import { fetchApi } from '@/lib/api/client';
import { useEntityQueryKeys } from '@/lib/query-keys/hooks/useEntityQueryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import type { EntityDetailConfig } from '../types';

type UseEntityEditProps<TData, TEditData> = {
    readonly config: EntityDetailConfig<TData, TEditData>;
    readonly id: string;
    readonly onSuccess?: (data: TData) => void;
    readonly onError?: (error: Error) => void;
};

/**
 * Hook to handle entity editing operations with improved cache management
 * Uses hierarchical query keys and optimistic updates
 */
export const useEntityEdit = <TData, TEditData>({
    config,
    id
}: UseEntityEditProps<TData, TEditData>) => {
    const queryClient = useQueryClient();
    const router = useRouter();
    const {
        queryKeys,
        invalidateDetail,
        invalidateLists,
        cancelDetail,
        getDetailData,
        setDetailData
    } = useEntityQueryKeys(config.name);

    const updateMutation = useMutation({
        mutationFn: async (data: TEditData): Promise<TData> => {
            // Validate data with edit schema
            const validatedData = config.editSchema.parse(data);

            const endpoint = config.updateEndpoint.replace(':id', id);

            const { data: result } = await fetchApi<TData>({
                path: endpoint,
                method: 'PUT',
                body: validatedData
            });

            return config.detailSchema.parse(result);
        },
        onMutate: async (newData: TEditData) => {
            // Cancel any outgoing refetches to avoid optimistic update conflicts
            await cancelDetail(id);

            // Snapshot the previous value
            const previousData = getDetailData<TData>(id);

            // Optimistically update the cache
            if (previousData) {
                setDetailData<TData>(id, (old) => {
                    if (!old) return previousData;
                    // Merge the new data with the existing data
                    return { ...old, ...newData } as TData;
                });
            }

            // Return context with the previous data for rollback
            return { previousData };
        },
        onSuccess: () => {
            // Invalidate related queries to ensure consistency
            invalidateDetail(id);
            invalidateLists();
        },
        onError: (_error, _newData, context) => {
            // Rollback the optimistic update on error
            if (context?.previousData) {
                setDetailData<TData>(id, context.previousData);
            }
        },
        onSettled: () => {
            // Always refetch the detail data to ensure consistency
            invalidateDetail(id);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (): Promise<void> => {
            if (!config.deleteEndpoint) {
                throw new Error('Delete operation not supported');
            }

            await fetchApi<void>({
                path: config.deleteEndpoint.replace(':id', id),
                method: 'DELETE'
            });
        },
        onMutate: async () => {
            // Cancel any outgoing refetches
            await cancelDetail(id);

            // Snapshot the previous data for potential rollback
            const previousData = getDetailData<TData>(id);

            return { previousData };
        },
        onSuccess: () => {
            // Remove the deleted entity from cache
            queryClient.removeQueries({
                queryKey: queryKeys.detail(id)
            });

            // Invalidate list queries to reflect the deletion
            invalidateLists();

            // Navigate back to list
            router.navigate({
                to: config.basePath
            });
        },
        onError: (error, _variables, context) => {
            // Restore the data if deletion failed and we had previous data
            if (context?.previousData) {
                setDetailData<TData>(id, context.previousData);
            }

            // Log the error for debugging
            console.error('Delete error:', error);
        }
    });

    return {
        update: updateMutation.mutate,
        delete: deleteMutation.mutate,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
        updateError: updateMutation.error,
        deleteError: deleteMutation.error
    };
};
