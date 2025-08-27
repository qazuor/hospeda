import type { EntityDetailConfig } from '@/components/entity-detail/types';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { createEntityPrefetcher } from '../entity-loader';

/**
 * Hook for entity prefetching capabilities
 * Provides methods to prefetch entity data on demand (e.g., on hover)
 */
export const useEntityPrefetch = <TData, TEditData>(
    config: EntityDetailConfig<TData, TEditData>
) => {
    const queryClient = useQueryClient();
    const prefetcher = createEntityPrefetcher(config, queryClient);

    /**
     * Prefetch entity detail data
     * Useful for hover prefetching on links
     */
    const prefetchDetail = useCallback(
        (id: string) => {
            // Only prefetch if not already cached
            if (!prefetcher.isCached(id)) {
                return prefetcher.prefetchDetail(id);
            }
        },
        [prefetcher]
    );

    /**
     * Prefetch specific relation data
     */
    const prefetchRelation = useCallback(
        (id: string, relationKey: string) => {
            return prefetcher.prefetchRelation(id, relationKey);
        },
        [prefetcher]
    );

    /**
     * Check if entity is cached
     */
    const isCached = useCallback(
        (id: string) => {
            return prefetcher.isCached(id);
        },
        [prefetcher]
    );

    /**
     * Get cached entity data without triggering a fetch
     */
    const getCachedData = useCallback(
        (id: string) => {
            return prefetcher.getCachedData(id);
        },
        [prefetcher]
    );

    /**
     * Prefetch multiple entities at once
     * Useful for prefetching visible items in a list
     */
    const prefetchMultiple = useCallback(
        async (ids: readonly string[]) => {
            const uncachedIds = ids.filter((id) => !prefetcher.isCached(id));

            if (uncachedIds.length === 0) return;

            // Prefetch in parallel with a reasonable limit
            const BATCH_SIZE = 5;
            const batches = [];

            for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
                const batch = uncachedIds.slice(i, i + BATCH_SIZE);
                batches.push(Promise.allSettled(batch.map((id) => prefetcher.prefetchDetail(id))));
            }

            await Promise.allSettled(batches);
        },
        [prefetcher]
    );

    return {
        prefetchDetail,
        prefetchRelation,
        prefetchMultiple,
        isCached,
        getCachedData
    };
};

/**
 * Hook for list-level prefetching
 * Provides utilities for prefetching based on user interactions with lists
 */
export const useListPrefetch = () => {
    const queryClient = useQueryClient();

    /**
     * Prefetch on intersection (when items come into view)
     * Can be used with Intersection Observer
     */
    const prefetchOnIntersection = useCallback(
        <TData, TEditData>(
            config: EntityDetailConfig<TData, TEditData>,
            id: string,
            _options?: {
                readonly threshold?: number;
                readonly rootMargin?: string;
            }
        ) => {
            const prefetcher = createEntityPrefetcher(config, queryClient);

            if (!prefetcher.isCached(id)) {
                // Add a small delay to avoid prefetching too aggressively
                setTimeout(() => {
                    prefetcher.prefetchDetail(id);
                }, 100);
            }
        },
        [queryClient]
    );

    /**
     * Prefetch on hover with debouncing
     */
    const prefetchOnHover = useCallback(
        <TData, TEditData>(
            config: EntityDetailConfig<TData, TEditData>,
            id: string,
            delay = 300
        ) => {
            const prefetcher = createEntityPrefetcher(config, queryClient);

            if (!prefetcher.isCached(id)) {
                setTimeout(() => {
                    prefetcher.prefetchDetail(id);
                }, delay);
            }
        },
        [queryClient]
    );

    return {
        prefetchOnIntersection,
        prefetchOnHover
    };
};
