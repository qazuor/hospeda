import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { createEntityQueryKeys } from '../factory';

/**
 * Hook for managing entity query keys and cache operations
 * Provides type-safe methods for cache invalidation and manipulation
 */
export const useEntityQueryKeys = (entityName: string) => {
    const queryClient = useQueryClient();
    const queryKeys = createEntityQueryKeys(entityName);

    /**
     * Invalidate all queries for this entity
     */
    const invalidateAll = useCallback(() => {
        return queryClient.invalidateQueries({
            queryKey: queryKeys.all
        });
    }, [queryClient, queryKeys.all]);

    /**
     * Invalidate all list queries for this entity
     */
    const invalidateLists = useCallback(() => {
        return queryClient.invalidateQueries({
            queryKey: queryKeys.lists()
        });
    }, [queryClient, queryKeys]);

    /**
     * Invalidate all detail queries for this entity
     */
    const invalidateDetails = useCallback(() => {
        return queryClient.invalidateQueries({
            queryKey: queryKeys.details()
        });
    }, [queryClient, queryKeys]);

    /**
     * Invalidate specific detail query
     * @param id - Entity ID
     */
    const invalidateDetail = useCallback(
        (id: string) => {
            return queryClient.invalidateQueries({
                queryKey: queryKeys.detail(id)
            });
        },
        [queryClient, queryKeys]
    );

    /**
     * Invalidate all relations for a specific entity
     * @param id - Entity ID
     */
    const invalidateRelations = useCallback(
        (id: string) => {
            return queryClient.invalidateQueries({
                queryKey: queryKeys.relations(id)
            });
        },
        [queryClient, queryKeys]
    );

    /**
     * Invalidate specific relation
     * @param id - Entity ID
     * @param relationType - Type of relation
     */
    const invalidateRelation = useCallback(
        (id: string, relationType: string) => {
            return queryClient.invalidateQueries({
                queryKey: queryKeys.relation(id, relationType)
            });
        },
        [queryClient, queryKeys]
    );

    /**
     * Remove all queries for this entity from cache
     */
    const removeAll = useCallback(() => {
        return queryClient.removeQueries({
            queryKey: queryKeys.all
        });
    }, [queryClient, queryKeys.all]);

    /**
     * Remove specific detail query from cache
     * @param id - Entity ID
     */
    const removeDetail = useCallback(
        (id: string) => {
            return queryClient.removeQueries({
                queryKey: queryKeys.detail(id)
            });
        },
        [queryClient, queryKeys]
    );

    /**
     * Get cached data for a specific detail query
     * @param id - Entity ID
     */
    const getDetailData = useCallback(
        <T>(id: string): T | undefined => {
            return queryClient.getQueryData<T>(queryKeys.detail(id));
        },
        [queryClient, queryKeys]
    );

    /**
     * Set cached data for a specific detail query
     * @param id - Entity ID
     * @param data - Data to cache
     */
    const setDetailData = useCallback(
        <T>(id: string, data: T | ((old: T | undefined) => T)) => {
            return queryClient.setQueryData<T>(queryKeys.detail(id), data);
        },
        [queryClient, queryKeys]
    );

    /**
     * Prefetch detail data
     * @param id - Entity ID
     * @param queryFn - Function to fetch the data
     * @param staleTime - How long the data should be considered fresh (default: 5 minutes)
     */
    const prefetchDetail = useCallback(
        <T>(id: string, queryFn: () => Promise<T>, staleTime: number = 5 * 60 * 1000) => {
            return queryClient.prefetchQuery({
                queryKey: queryKeys.detail(id),
                queryFn,
                staleTime
            });
        },
        [queryClient, queryKeys]
    );

    /**
     * Cancel all outgoing queries for this entity
     */
    const cancelAll = useCallback(() => {
        return queryClient.cancelQueries({
            queryKey: queryKeys.all
        });
    }, [queryClient, queryKeys.all]);

    /**
     * Cancel specific detail query
     * @param id - Entity ID
     */
    const cancelDetail = useCallback(
        (id: string) => {
            return queryClient.cancelQueries({
                queryKey: queryKeys.detail(id)
            });
        },
        [queryClient, queryKeys]
    );

    /**
     * Check if detail data exists in cache
     * @param id - Entity ID
     */
    const hasDetailData = useCallback(
        (id: string): boolean => {
            return queryClient.getQueryData(queryKeys.detail(id)) !== undefined;
        },
        [queryClient, queryKeys]
    );

    /**
     * Get query state for detail query
     * @param id - Entity ID
     */
    const getDetailQueryState = useCallback(
        (id: string) => {
            return queryClient.getQueryState(queryKeys.detail(id));
        },
        [queryClient, queryKeys]
    );

    return {
        // Query key factories
        queryKeys,

        // Invalidation methods
        invalidateAll,
        invalidateLists,
        invalidateDetails,
        invalidateDetail,
        invalidateRelations,
        invalidateRelation,

        // Cache manipulation
        removeAll,
        removeDetail,
        getDetailData,
        setDetailData,

        // Prefetching
        prefetchDetail,

        // Query control
        cancelAll,
        cancelDetail,

        // Utility methods
        hasDetailData,
        getDetailQueryState
    };
};
