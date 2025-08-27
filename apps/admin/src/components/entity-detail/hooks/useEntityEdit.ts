import { fetchApi } from '@/lib/api/client';
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
 * Hook to handle entity editing operations
 */
export const useEntityEdit = <TData, TEditData>({
    config,
    id
}: UseEntityEditProps<TData, TEditData>) => {
    const queryClient = useQueryClient();
    const router = useRouter();

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
        onSuccess: () => {
            // Only invalidate queries - don't call callbacks or navigate
            queryClient.invalidateQueries({
                queryKey: [config.name, 'detail', id]
            });
            queryClient.invalidateQueries({
                queryKey: [config.name, 'list']
            });
        },
        onError: () => {
            // Don't call onError callback - let the form handle it
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
        onSuccess: () => {
            // Invalidate list query
            queryClient.invalidateQueries({
                queryKey: [config.name, 'list']
            });

            // Navigate back to list
            router.navigate({
                to: config.basePath
            });
        },
        onError: (error) => {
            // Handle delete error - could be extended in the future
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
