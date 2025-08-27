/**
 * Loaders System - TanStack Router Integration
 *
 * This module provides loader functions for TanStack Router routes
 * with prefetching capabilities and optimized data loading.
 *
 * @example
 * ```typescript
 * import { createEntityLoader } from '@/lib/loaders';
 *
 * export const Route = createFileRoute('/accommodations/$id/')({
 *     loader: createEntityLoader(accommodationsDetailConfig),
 *     component: AccommodationViewPage
 * });
 * ```
 */

// Export loader functions
export {
    createEntityListLoader,
    createEntityLoader,
    createEntityPrefetcher,
    type EntityLoaderContext,
    type EntityLoaderParams
} from './entity-loader';

// Export hooks
export {
    useEntityPrefetch,
    useListPrefetch
} from './hooks/useEntityPrefetch';

import type { EntityDetailConfig } from '@/components/entity-detail';
/**
 * Pre-configured loaders for common entities
 * These can be imported directly for convenience
 */
import { accommodationsDetailConfig } from '@/features/accommodations/config/accommodations-detail.config';
import { createEntityLoader } from '@/lib/loaders/entity-loader';

// Note: Add other entity configs as they become available
// import { destinationsDetailConfig } from '@/features/destinations/config/destinations-detail.config';
// import { postsDetailConfig } from '@/features/posts/config/posts-detail.config';

export const accommodationLoader = createEntityLoader(accommodationsDetailConfig);

// TODO [68833855-8d17-4d5c-bd7b-d62c39b6f47c]: Add other pre-configured loaders as entity configs become available
// export const destinationLoader = createEntityLoader(destinationsDetailConfig);
// export const postLoader = createEntityLoader(postsDetailConfig);

/**
 * Utility function to create a loader with error boundaries
 * Wraps the loader with additional error handling and logging
 */
export const createSafeEntityLoader = <TData, TEditData>(
    config: Parameters<typeof createEntityLoader>[0]
) => {
    const baseLoader = createEntityLoader(config as EntityDetailConfig<TData, TEditData>);

    return async (params: Parameters<typeof baseLoader>[0]) => {
        try {
            return await baseLoader(params);
        } catch (error) {
            // Log the error for monitoring
            console.error(`Loader error for ${config.name}:`, error);

            // Return a safe fallback
            return {
                entityId: params.params.id,
                entityName: config.name,
                prefetched: false,
                error: error instanceof Error ? error.message : 'Unknown loader error'
            };
        }
    };
};
