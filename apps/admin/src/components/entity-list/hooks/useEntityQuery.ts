import { useQuery } from '@tanstack/react-query';
import type { EntityQueryParams, EntityQueryResponse } from '../types';

/**
 * Generic hook for entity queries
 */
export const useEntityQuery = <TData>(
    entityName: string,
    queryFn: (params: EntityQueryParams) => Promise<EntityQueryResponse<TData>>,
    params: EntityQueryParams
) => {
    return useQuery<EntityQueryResponse<TData>, Error>({
        queryKey: [entityName, params],
        queryFn: () => queryFn(params),
        staleTime: 30_000,
        select: (data) => data
    });
};
