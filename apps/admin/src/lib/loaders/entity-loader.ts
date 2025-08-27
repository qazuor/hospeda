import type { EntityDetailConfig } from '@/components/entity-detail/types';
import { fetchApi } from '@/lib/api/client';
import { createEntityQueryKeys } from '@/lib/query-keys/factory';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Generic entity loader for TanStack Router
 * Provides prefetching capabilities for entity detail pages
 */

export type EntityLoaderContext = {
    readonly auth?: {
        readonly userId: string;
        readonly permissions: readonly string[];
    };
};

export type EntityLoaderParams = {
    readonly id: string;
};

/**
 * Creates a loader function for entity detail routes
 * This loader provides basic route information without prefetching
 * Prefetching will be handled by components using TanStack Query hooks
 *
 * @param config - Entity detail configuration
 * @returns Loader function for TanStack Router
 */
export const createEntityLoader = <TData, TEditData>(
    config: EntityDetailConfig<TData, TEditData>
) => {
    return async ({
        params
    }: {
        readonly params: EntityLoaderParams;
    }) => {
        const { id } = params;

        // Basic validation
        if (!id) {
            throw new Error(`Invalid ${config.name} ID`);
        }

        // Return basic loader data
        // Actual data fetching will be handled by components
        return {
            entityId: id,
            entityName: config.name,
            config: {
                name: config.name,
                displayName: config.displayName,
                basePath: config.basePath
            }
        };
    };
};

/**
 * Creates a loader for entity list routes
 * Prefetches list data with default parameters
 *
 * @param entityName - Name of the entity
 * @param defaultParams - Default query parameters
 * @returns Loader function for entity list routes
 */
export const createEntityListLoader = (
    entityName: string,
    defaultParams: Record<string, unknown> = {}
) => {
    return async () => {
        // Return basic loader data
        // Actual data fetching will be handled by components
        return {
            entityName,
            defaultParams
        };
    };
};

/**
 * Utility to create a prefetch function for use in components
 * This can be used for hover prefetching or manual prefetching
 *
 * @param config - Entity detail configuration
 * @param queryClient - TanStack Query client
 * @returns Prefetch function
 */
export const createEntityPrefetcher = <TData, TEditData>(
    config: EntityDetailConfig<TData, TEditData>,
    queryClient: QueryClient
) => {
    const queryKeys = createEntityQueryKeys(config.name);

    return {
        /**
         * Prefetch entity detail data
         * @param id - Entity ID
         */
        prefetchDetail: async (id: string) => {
            return queryClient.prefetchQuery({
                queryKey: queryKeys.detail(id),
                queryFn: async (): Promise<TData> => {
                    const endpoint = config.getEndpoint.replace(':id', id);

                    const { data } = await fetchApi<TData>({
                        path: endpoint,
                        method: 'GET'
                    });

                    let actualData = data;
                    if (data && typeof data === 'object' && 'data' in data) {
                        actualData = (data as { data: TData }).data;
                    }

                    return config.detailSchema.parse(actualData);
                },
                staleTime: 5 * 60 * 1000
            });
        },

        /**
         * Prefetch entity relations
         * @param id - Entity ID
         * @param relationKey - Specific relation to prefetch
         */
        prefetchRelation: async (id: string, relationKey: string) => {
            const relation = config.relations?.find(
                (r: { key: string; endpoint: string; displayName: string }) => r.key === relationKey
            );
            if (!relation?.endpoint) return;

            return queryClient.prefetchQuery({
                queryKey: queryKeys.relation(id, relationKey),
                queryFn: async () => {
                    const endpoint = relation.endpoint.replace(':id', id);
                    const { data } = await fetchApi({
                        path: endpoint,
                        method: 'GET'
                    });
                    return data;
                },
                staleTime: 2 * 60 * 1000
            });
        },

        /**
         * Check if entity data is already cached
         * @param id - Entity ID
         */
        isCached: (id: string): boolean => {
            return queryClient.getQueryData(queryKeys.detail(id)) !== undefined;
        },

        /**
         * Get cached entity data
         * @param id - Entity ID
         */
        getCachedData: (id: string): TData | undefined => {
            return queryClient.getQueryData<TData>(queryKeys.detail(id));
        }
    };
};
