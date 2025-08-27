import { createEntityQueryKeys } from '@/lib/query-keys/factory';
import { useQuery } from '@tanstack/react-query';
import type { EntityQueryParams, EntityQueryResponse } from '../types';

/**
 * Generic hook for entity queries with improved query key management
 * Uses hierarchical query keys for better cache invalidation
 */
export const useEntityQuery = <TData>(
    entityName: string,
    queryFn: (params: EntityQueryParams) => Promise<EntityQueryResponse<TData>>,
    params: EntityQueryParams
) => {
    const queryKeys = createEntityQueryKeys(entityName);

    return useQuery<EntityQueryResponse<TData>, Error>({
        queryKey: queryKeys.list(params),
        queryFn: () => queryFn(params),
        staleTime: 30_000, // 30 seconds
        gcTime: 5 * 60 * 1000, // 5 minutes
        retry: (failureCount, error) => {
            // Don't retry on client errors (4xx)
            if (error && typeof error === 'object' && 'status' in error) {
                const status = error.status as number;
                if (status >= 400 && status < 500) {
                    return false;
                }
            }
            return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        refetchOnWindowFocus: false, // Lists don't need to refetch on focus
        refetchOnReconnect: true,
        select: (data) => data
    });
};
