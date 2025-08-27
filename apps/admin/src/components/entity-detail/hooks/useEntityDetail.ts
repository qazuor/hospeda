import { fetchApi } from '@/lib/api/client';
import { createEntityQueryKeys } from '@/lib/query-keys/factory';
import { useQuery } from '@tanstack/react-query';
import type { EntityDetailConfig } from '../types';

type UseEntityDetailProps<TData, TEditData> = {
    readonly config: EntityDetailConfig<TData, TEditData>;
    readonly id: string;
};

/**
 * Hook to fetch entity detail data with improved query key management
 * Uses hierarchical query keys for better cache invalidation
 */
export const useEntityDetail = <TData, TEditData>({
    config,
    id
}: UseEntityDetailProps<TData, TEditData>) => {
    const queryKeys = createEntityQueryKeys(config.name);

    return useQuery({
        queryKey: queryKeys.detail(id),
        queryFn: async (): Promise<TData> => {
            const endpoint = config.getEndpoint.replace(':id', id);

            const { data } = await fetchApi<TData>({
                path: endpoint,
                method: 'GET'
            });

            // Check if data is wrapped in a success/data structure
            let actualData = data;
            if (data && typeof data === 'object' && 'data' in data) {
                actualData = (data as { data: TData }).data;
            }

            // Validate response with schema
            return config.detailSchema.parse(actualData);
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes (cache time)
        retry: (failureCount, error) => {
            // Don't retry on 404 errors
            if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
                return false;
            }
            return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true
    });
};
