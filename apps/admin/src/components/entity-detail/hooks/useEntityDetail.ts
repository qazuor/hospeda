import { fetchApi } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import type { EntityDetailConfig } from '../types';

type UseEntityDetailProps<TData, TEditData> = {
    readonly config: EntityDetailConfig<TData, TEditData>;
    readonly id: string;
};

/**
 * Hook to fetch entity detail data
 */
export const useEntityDetail = <TData, TEditData>({
    config,
    id
}: UseEntityDetailProps<TData, TEditData>) => {
    return useQuery({
        queryKey: [config.name, 'detail', id],
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
        retry: 2
    });
};
